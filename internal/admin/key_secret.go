package admin

import (
	"errors"
	"net/http"
	"net/url"
	"strings"
)

// keySecret reads one native virtual key only when an admin explicitly requests it.
func (s *Server) keySecret(w http.ResponseWriter, r *http.Request, id string) {
	var result struct {
		VirtualKey nativeVK `json:"virtual_key"`
	}
	if err := s.live.client.call(r.Context(), http.MethodGet, "/api/governance/virtual-keys/"+url.PathEscape(id), nil, &result); err != nil {
		var status nativeHTTPError
		if errors.As(err, &status) {
			switch int(status) {
			case http.StatusNotFound:
				reply(w, http.StatusNotFound, map[string]string{"error": "Native virtual key not found"})
				return
			case http.StatusUnauthorized, http.StatusForbidden:
				reply(w, http.StatusForbidden, map[string]string{"error": status.Error() + ": native admin authorization failed"})
				return
			}
		}
		reply(w, http.StatusBadGateway, map[string]string{"error": "Native virtual key read failed"})
		return
	}
	if result.VirtualKey.ID != id {
		reply(w, http.StatusBadGateway, map[string]string{"error": "Native virtual key response did not match the requested key"})
		return
	}
	secret := result.VirtualKey.Value
	if strings.TrimSpace(secret) == "" || strings.ContainsAny(secret, "*•") || strings.EqualFold(secret, "<redacted>") {
		reply(w, http.StatusConflict, map[string]string{"error": "Native virtual key secret is unavailable or masked"})
		return
	}
	reply(w, http.StatusOK, map[string]string{"secret": secret})
}
