package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/heroiclabs/nakama-common/runtime"
)

func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {

	if err := nk.LeaderboardCreate(ctx, "wins", false, "desc", "incr", "", nil); err != nil {
		logger.Error("Failed to create wins leaderboard: %v", err)
		return err
	}

	if err := nk.LeaderboardCreate(ctx, "win_streaks", false, "desc", "incr", "", nil); err != nil {
		logger.Error("Failed to create win_streaks leaderboard: %v", err)
		return err
	}

	if err := initializer.RegisterMatch("tictactoe", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &TicTacToeMatch{logger: logger, db: db, nk: nk}, nil
	}); err != nil {
		return fmt.Errorf("RegisterMatch: %v", err)
	}

	if err := initializer.RegisterRpc("create_match", rpcCreateMatch); err != nil {
		return fmt.Errorf("RegisterRpc create_match: %v", err)
	}

	if err := initializer.RegisterRpc("list_matches", rpcListMatches); err != nil {
		return fmt.Errorf("RegisterRpc list_matches: %v", err)
	}

	if err := initializer.RegisterRpc("submit_game_result", rpcSubmitGameResult); err != nil {
		return fmt.Errorf("RegisterRpc submit_game_result: %v", err)
	}

	if err := initializer.RegisterRpc("get_leaderboard", rpcGetLeaderboard); err != nil {
		return fmt.Errorf("RegisterRpc get_leaderboard: %v", err)
	}

	if err := initializer.RegisterRpc("update_player_profile", rpcUpdatePlayerProfile); err != nil {
		return fmt.Errorf("RegisterRpc update_player_profile: %v", err)
	}

	logger.Info("TicTacToe module initialized")
	return nil
}

func rpcCreateMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var params struct {
		Username string `json:"username"`
		Mode     string `json:"mode"`
	}
	if err := json.Unmarshal([]byte(payload), &params); err != nil {
		return "", &runtime.Error{Message: "Invalid payload"}
	}

	if params.Mode == "" {
		params.Mode = "classic"
	}
	if params.Mode != "classic" && params.Mode != "timed" {
		return "", &runtime.Error{Message: "Invalid mode. Use 'classic' or 'timed'"}
	}

	matchID, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{
		"mode":    params.Mode,
		"creator": params.Username,
	})
	if err != nil {
		logger.Error("MatchCreate failed: %v", err)
		return "", &runtime.Error{Message: "Failed to create match"}
	}

	result, _ := json.Marshal(map[string]string{
		"matchId": matchID,
		"mode":    params.Mode,
	})
	return string(result), nil
}

func rpcListMatches(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var params struct {
		Mode string `json:"mode"`
	}
	if err := json.Unmarshal([]byte(payload), &params); err != nil {
		// ignore parse errors, list all
	}

	minSize := 0
	maxSize := 1
	matches, err := nk.MatchList(ctx, 20, true, "", &minSize, &maxSize, "")
	if err != nil {
		logger.Error("MatchList failed: %v", err)
		return "", &runtime.Error{Message: "Failed to list matches"}
	}

	type MatchInfo struct {
		MatchID string `json:"matchId"`
		Label   string `json:"label"`
		Size    int    `json:"size"`
		Mode    string `json:"mode"`
	}

	result := []MatchInfo{}
	for _, m := range matches {
		labelStr := ""
		if m.Label != nil {
			labelStr = m.Label.Value
		}

		var labelData map[string]interface{}
		json.Unmarshal([]byte(labelStr), &labelData)

		mode := "classic"
		if lm, ok := labelData["mode"].(string); ok {
			mode = lm
		}

		if params.Mode != "" && mode != params.Mode {
			continue
		}

		result = append(result, MatchInfo{
			MatchID: m.MatchId,
			Label:   labelStr,
			Size:    int(m.Size),
			Mode:    mode,
		})
	}

	data, _ := json.Marshal(map[string]interface{}{
		"matches": result,
	})
	return string(data), nil
}

func rpcSubmitGameResult(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var params struct {
		WinnerID   string `json:"winnerId"`
		LoserID    string `json:"loserId"`
		WinnerName string `json:"winnerName"`
		LoserName  string `json:"loserName"`
	}
	if err := json.Unmarshal([]byte(payload), &params); err != nil {
		return "", &runtime.Error{Message: "Invalid payload"}
	}

	if params.WinnerID != "" {
		if _, err := nk.LeaderboardRecordWrite(ctx, "wins", params.WinnerID, params.WinnerName, 1, 0, nil, nil); err != nil {
			logger.Warn("Failed to write wins leaderboard: %v", err)
		}
		if _, err := nk.LeaderboardRecordWrite(ctx, "win_streaks", params.WinnerID, params.WinnerName, 1, 0, nil, nil); err != nil {
			logger.Warn("Failed to write win_streaks leaderboard: %v", err)
		}
	}

	if params.LoserID != "" {
		if _, err := nk.LeaderboardRecordWrite(ctx, "losses", params.LoserID, params.LoserName, 1, 0, nil, nil); err != nil {
			logger.Warn("Failed to write losses leaderboard: %v", err)
		}
		
		opSet := 2 // 2 corresponds to Operator_SET
		if _, err := nk.LeaderboardRecordWrite(ctx, "win_streaks", params.LoserID, params.LoserName, 0, 0, nil, &opSet); err != nil {
			logger.Warn("Failed to reset win_streaks: %v", err)
		}
	}

	result, _ := json.Marshal(map[string]string{
		"status": "ok",
	})
	return string(result), nil
}

func rpcGetLeaderboard(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var params struct {
		Name   string `json:"name"`
		Limit  int    `json:"limit"`
		Cursor string `json:"cursor"`
	}
	if err := json.Unmarshal([]byte(payload), &params); err != nil {
		params.Name = "wins"
		params.Limit = 10
	}
	if params.Limit <= 0 {
		params.Limit = 10
	}

	records, _, _, _, err := nk.LeaderboardRecordsList(ctx, params.Name, nil, params.Limit, params.Cursor, 0)
	if err != nil {
		logger.Error("LeaderboardRecordsList failed: %v", err)
		return "", &runtime.Error{Message: "Failed to fetch leaderboard"}
	}

	type Record struct {
		Owner    string `json:"owner"`
		Username string `json:"username"`
		Score    int64  `json:"score"`
		Rank     int64  `json:"rank"`
	}

	result := []Record{}
	for i, r := range records {
		username := ""
		if r.Username != nil {
			username = r.Username.Value
		}
		result = append(result, Record{
			Owner:    r.OwnerId,
			Username: username,
			Score:    r.Score,
			Rank:     int64(i + 1),
		})
	}

	data, _ := json.Marshal(map[string]interface{}{
		"name":    params.Name,
		"records": result,
	})
	return string(data), nil
}

func rpcUpdatePlayerProfile(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	var params struct {
		Username string `json:"username"`
	}
	if err := json.Unmarshal([]byte(payload), &params); err != nil {
		return "", &runtime.Error{Message: "Invalid payload"}
	}

	if params.Username == "" {
		return "", &runtime.Error{Message: "Username required"}
	}

	userID, ok := ctx.Value(runtime.RUNTIME_CTX_USER_ID).(string)
	if !ok {
		return "", &runtime.Error{Message: "Not authenticated"}
	}

	if err := nk.AccountUpdateId(ctx, userID, params.Username, nil, params.Username, "", "", "", ""); err != nil {
		logger.Error("AccountUpdateId failed: %v", err)
		return "", &runtime.Error{Message: "Failed to update profile"}
	}

	result, _ := json.Marshal(map[string]string{
		"status":   "ok",
		"username": params.Username,
	})
	return string(result), nil
}
