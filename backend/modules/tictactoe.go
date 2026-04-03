package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

const (
	CellEmpty = ""
	CellX     = "X"
	CellO     = "O"
)

const (
	PhaseWaiting  = "waiting"
	PhasePlaying  = "playing"
	PhaseFinished = "finished"
)

const (
	OpMove     = 2
	OpState    = 3
	OpGameOver = 4
	OpChat     = 5
)

const TurnTimeLimit = 30

type Board [9]string

type GameState struct {
	Board       Board  `json:"board"`
	CurrentTurn string `json:"currentTurn"`
	Phase       string `json:"phase"`
	Mode        string `json:"mode"`
	Winner      string `json:"winner"`
	WinnerName  string `json:"winnerName"`
	TurnStarted int64  `json:"turnStarted"`
	PlayerX     string `json:"playerX"`
	PlayerO     string `json:"playerO"`
	PlayerXName string `json:"playerXName"`
	PlayerOName string `json:"playerOName"`
}

type TicTacToeMatch struct {
	logger runtime.Logger
	db     *sql.DB
	nk     runtime.NakamaModule
}

func (m *TicTacToeMatch) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	mode := "classic"
	if mv, ok := params["mode"].(string); ok {
		mode = mv
	}

	state := GameState{
		Board:       Board{},
		Phase:       PhaseWaiting,
		Mode:        mode,
		CurrentTurn: "",
		Winner:      "",
	}

	tickRate := 1
	label := fmt.Sprintf(`{"mode":"%s"}`, mode)

	return state, tickRate, label
}

func (m *TicTacToeMatch) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	s := state.(GameState)

	if s.Phase == PhaseFinished {
		return state, false, "Game is already finished"
	}

	if s.Phase == PhaseWaiting && s.PlayerX == presence.GetUserId() {
		return state, false, "Cannot join a game against yourself!"
	}

	if s.Phase == PhasePlaying && (s.PlayerX == presence.GetUserId() || s.PlayerO == presence.GetUserId()) {
		return state, true, ""
	}

	if s.Phase == PhasePlaying {
		return state, false, "Game is already in progress with 2 players"
	}

	return state, true, ""
}

func (m *TicTacToeMatch) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(GameState)

	for _, p := range presences {
		userID := p.GetUserId()
		username := p.GetUsername()

		if s.PlayerX == "" {
			s.PlayerX = userID
			s.PlayerXName = username
			s.CurrentTurn = userID
		} else if s.PlayerO == "" {
			s.PlayerO = userID
			s.PlayerOName = username
		} else {
			continue
		}
	}

	if s.PlayerX != "" && s.PlayerO != "" && s.Phase == PhaseWaiting {
		s.Phase = PhasePlaying
		s.TurnStarted = time.Now().Unix()

		stateData, _ := json.Marshal(map[string]interface{}{
			"type":  "state",
			"state": s,
		})
		dispatcher.BroadcastMessage(OpState, stateData, nil, nil, true)
	}

	return s
}

func (m *TicTacToeMatch) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(GameState)

	for _, p := range presences {
		userID := p.GetUserId()

		if s.Phase == PhasePlaying {
			if userID == s.PlayerX || userID == s.PlayerO {
				var winnerID, winnerName, loserID, loserName string
				if userID == s.PlayerX {
					winnerID = s.PlayerO
					winnerName = s.PlayerOName
					loserID = s.PlayerX
					loserName = s.PlayerXName
				} else {
					winnerID = s.PlayerX
					winnerName = s.PlayerXName
					loserID = s.PlayerO
					loserName = s.PlayerOName
				}

				s.Phase = PhaseFinished
				s.Winner = winnerID
				s.WinnerName = winnerName

				go submitResult(ctx, nk, logger, winnerID, winnerName, loserID, loserName)

				gameOverData, _ := json.Marshal(map[string]interface{}{
					"type":       "gameOver",
					"winner":     winnerID,
					"winnerName": winnerName,
					"reason":     "disconnect",
				})
				dispatcher.BroadcastMessage(OpGameOver, gameOverData, nil, nil, true)
			}
		} else if s.Phase == PhaseWaiting {
			if userID == s.PlayerX {
				s.PlayerX = ""
				s.PlayerXName = ""
				s.CurrentTurn = ""
			} else if userID == s.PlayerO {
				s.PlayerO = ""
				s.PlayerOName = ""
			}
		}
	}

	return s
}

func (m *TicTacToeMatch) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	s := state.(GameState)

	if s.Phase != PhasePlaying {
		return s
	}

	if s.Mode == "timed" && s.CurrentTurn != "" {
		elapsed := time.Now().Unix() - s.TurnStarted
		if elapsed >= TurnTimeLimit {
			var winnerID, winnerName, loserID, loserName string
			if s.CurrentTurn == s.PlayerX {
				winnerID = s.PlayerO
				winnerName = s.PlayerOName
				loserID = s.PlayerX
				loserName = s.PlayerXName
			} else {
				winnerID = s.PlayerX
				winnerName = s.PlayerXName
				loserID = s.PlayerO
				loserName = s.PlayerOName
			}

			s.Phase = PhaseFinished
			s.Winner = winnerID
			s.WinnerName = winnerName

			go submitResult(ctx, nk, logger, winnerID, winnerName, loserID, loserName)

			gameOverData, _ := json.Marshal(map[string]interface{}{
				"type":       "gameOver",
				"winner":     winnerID,
				"winnerName": winnerName,
				"reason":     "timeout",
			})
			dispatcher.BroadcastMessage(OpGameOver, gameOverData, nil, nil, true)
			return s
		}

		remaining := TurnTimeLimit - elapsed
		timerData, _ := json.Marshal(map[string]interface{}{
			"type":      "timer",
			"remaining": remaining,
		})
		dispatcher.BroadcastMessage(OpState, timerData, nil, nil, true)
	}

	for _, msg := range messages {
		userID := msg.GetUserId()

		switch msg.GetOpCode() {
		case OpMove:
			if s.Phase != PhasePlaying {
				continue
			}

			if userID != s.CurrentTurn {
				errorData, _ := json.Marshal(map[string]string{
					"type":    "error",
					"message": "Not your turn",
				})
				dispatcher.BroadcastMessage(OpState, errorData, []runtime.Presence{msg}, nil, true)
				continue
			}

			var moveData struct {
				Index int `json:"index"`
			}
			if err := json.Unmarshal(msg.GetData(), &moveData); err != nil {
				continue
			}

			if moveData.Index < 0 || moveData.Index > 8 {
				continue
			}

			if s.Board[moveData.Index] != CellEmpty {
				errorData, _ := json.Marshal(map[string]string{
					"type":    "error",
					"message": "Cell already occupied",
				})
				dispatcher.BroadcastMessage(OpState, errorData, []runtime.Presence{msg}, nil, true)
				continue
			}

			mark := CellX
			if userID == s.PlayerO {
				mark = CellO
			}
			s.Board[moveData.Index] = mark

			winnerMark := checkWinner(s.Board)
			if winnerMark != "" {
				s.Phase = PhaseFinished

				var winnerID, winnerName, loserID, loserName string
				if winnerMark == "draw" {
					s.Winner = "draw"
					s.WinnerName = ""
				} else if winnerMark == CellX {
					winnerID = s.PlayerX
					winnerName = s.PlayerXName
					loserID = s.PlayerO
					loserName = s.PlayerOName
					s.Winner = winnerID
					s.WinnerName = winnerName
				} else {
					winnerID = s.PlayerO
					winnerName = s.PlayerOName
					loserID = s.PlayerX
					loserName = s.PlayerXName
					s.Winner = winnerID
					s.WinnerName = winnerName
				}

				if winnerMark != "draw" {
					go submitResult(ctx, nk, logger, winnerID, winnerName, loserID, loserName)
				}

				gameOverData, _ := json.Marshal(map[string]interface{}{
					"type":       "gameOver",
					"winner":     s.Winner,
					"winnerName": s.WinnerName,
					"reason":     "win",
				})
				dispatcher.BroadcastMessage(OpGameOver, gameOverData, nil, nil, true)
			} else {
				if s.CurrentTurn == s.PlayerX {
					s.CurrentTurn = s.PlayerO
				} else {
					s.CurrentTurn = s.PlayerX
				}
				s.TurnStarted = time.Now().Unix()
			}

			stateData, _ := json.Marshal(map[string]interface{}{
				"type":  "state",
				"state": s,
			})
			dispatcher.BroadcastMessage(OpState, stateData, nil, nil, true)

		case OpChat:
			dispatcher.BroadcastMessage(OpChat, msg.GetData(), nil, msg, true)
		}
	}

	return s
}

func (m *TicTacToeMatch) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	return state
}

func (m *TicTacToeMatch) MatchSignal(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, data string) (interface{}, string) {
	_ = data
	return state, ""
}

func checkWinner(board Board) string {
	lines := [8][3]int{
		{0, 1, 2}, {3, 4, 5}, {6, 7, 8},
		{0, 3, 6}, {1, 4, 7}, {2, 5, 8},
		{0, 4, 8}, {2, 4, 6},
	}

	for _, line := range lines {
		a, b, c := line[0], line[1], line[2]
		if board[a] != CellEmpty && board[a] == board[b] && board[b] == board[c] {
			if board[a] == CellX {
				return CellX
			}
			return CellO
		}
	}

	for _, cell := range board {
		if cell == CellEmpty {
			return ""
		}
	}

	return "draw"
}

func submitResult(ctx context.Context, nk runtime.NakamaModule, logger runtime.Logger, winnerID, winnerName, loserID, loserName string) {
	if winnerID != "" {
		if _, err := nk.LeaderboardRecordWrite(ctx, "wins", winnerID, winnerName, 1, 0, nil, nil); err != nil {
			logger.Warn("Failed to write wins: %v", err)
		}
		if _, err := nk.LeaderboardRecordWrite(ctx, "win_streaks", winnerID, winnerName, 1, 0, nil, nil); err != nil {
			logger.Warn("Failed to write win_streaks: %v", err)
		}
	}
	if loserID != "" {
		if _, err := nk.LeaderboardRecordWrite(ctx, "losses", loserID, loserName, 1, 0, nil, nil); err != nil {
			logger.Warn("Failed to write losses: %v", err)
		}
		if _, err := nk.LeaderboardRecordWrite(ctx, "win_streaks", loserID, loserName, 0, 0, nil, nil); err != nil {
			logger.Warn("Failed to reset win_streaks: %v", err)
		}
	}
}
