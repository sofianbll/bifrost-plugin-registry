//go:build bifrost

// Legacy dynamic plugin fixture: deliberately has no GetAdminUI export.
package main

import (
	"strings"

	"github.com/maximhq/bifrost/core/schemas"
)

func GetName() string { return "legacy-hook-proof" }
func Init(any) error  { return nil }
func Cleanup() error  { return nil }

func HTTPTransportPreHook(_ *schemas.BifrostContext, req *schemas.HTTPRequest) (*schemas.HTTPResponse, error) {
	if req == nil || req.Method != "POST" || req.Path != "/v1/chat/completions" {
		return nil, nil
	}
	probe := false
	for key, value := range req.Headers {
		if strings.EqualFold(key, "X-Legacy-Plugin-Probe") && value == "1" {
			probe = true
			break
		}
	}
	if !probe {
		return nil, nil
	}
	return &schemas.HTTPResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"Content-Type":         "application/json",
			"X-Legacy-Plugin-Hook": "executed",
		},
		Body: []byte(`{"id":"legacy-hook-proof","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"legacy hook executed"},"finish_reason":"stop"}]}`),
	}, nil
}
