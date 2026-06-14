"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Wrench, Server, Loader2, CheckCircle2, AlertCircle, Cpu, Key, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { showSuccess, showError } from "@/lib/toast";

interface ExecutionConfig {
  maxTurns: number;
  timeoutMinutes: number;
  retries: number;
  retryDelayMinutes: number;
  skipPermissions: boolean;
  allowedTools: string[];
  agentTeams: boolean;
  claudeBinaryPath: string | null;
  agentBinaryPath: string | null;
  maxTaskContinuations: number;
  ollama: { enabled: boolean; model: string | null };
  engineType: string;
}

interface DaemonConfig {
  execution?: Record<string, unknown>;
}

export default function SettingsPage() {
  const [executionConfig, setExecutionConfig] = useState<ExecutionConfig | null>(null);
  const [agentBinaryPath, setAgentBinaryPath] = useState("");
  const [engineType, setEngineType] = useState("auto");
  const [ollamaEnabled, setOllamaEnabled] = useState(false);
  const [ollamaModel, setOllamaModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [customApiKey, setCustomApiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");

  // Load current config
  useEffect(() => {
    fetch("/api/daemon")
      .then((r) => r.json())
      .then((data) => {
        const cfg = data.config as DaemonConfig;
        const ex = cfg.execution;
        if (ex) {
          setExecutionConfig({
            maxTurns: (ex.maxTurns as number) ?? 25,
            timeoutMinutes: (ex.timeoutMinutes as number) ?? 30,
            retries: (ex.retries as number) ?? 1,
            retryDelayMinutes: (ex.retryDelayMinutes as number) ?? 5,
            skipPermissions: (ex.skipPermissions as boolean) ?? false,
            allowedTools: (ex.allowedTools as string[]) ?? [],
            agentTeams: (ex.agentTeams as boolean) ?? false,
            claudeBinaryPath: (ex.claudeBinaryPath as string) ?? null,
            agentBinaryPath: (ex.agentBinaryPath as string) ?? null,
            maxTaskContinuations: (ex.maxTaskContinuations as number) ?? 2,
            ollama: {
              enabled: (ex.ollama as Record<string, unknown>)?.enabled === true,
              model: ((ex.ollama as Record<string, unknown>)?.model as string) ?? null,
            },
            engineType: (ex.engineType as string) ?? "auto",
          });
          setAgentBinaryPath((ex.agentBinaryPath as string) ?? "");
          setEngineType((ex.engineType as string) ?? "auto");
          setOllamaEnabled((ex.ollama as Record<string, unknown>)?.enabled === true);
          setOllamaModel(((ex.ollama as Record<string, unknown>)?.model as string) ?? "");
        }
        // Load custom engine .env
        return fetch("/api/settings/custom-engine-env");
      })
      .then((r) => r?.json())
      .then((envData) => {
        if (envData) {
          setCustomApiKey(envData.CUSTOM_ENGINE_API_KEY ?? "");
          setCustomBaseUrl(envData.CUSTOM_ENGINE_BASE_URL ?? "");
        }
      })
      .catch(() => {});
  }, []);

  // Auto-fetch Ollama models when toggle is enabled
  const fetchModels = useCallback(async () => {
    setFetchingModels(true);
    setModelsError(null);
    try {
      const res = await fetch("/api/ollama/models");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setAvailableModels(data.models ?? []);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : "Fetch failed");
      setAvailableModels([]);
    } finally {
      setFetchingModels(false);
    }
  }, []);

  useEffect(() => {
    if (ollamaEnabled) {
      fetchModels();
    } else {
      setAvailableModels([]);
      setModelsError(null);
    }
  }, [ollamaEnabled, fetchModels]);

  const handleSave = async () => {
    if (!executionConfig) return;
    setSaving(true);
    try {
      const body = {
        execution: {
          ...executionConfig,
          engineType,
          agentBinaryPath: agentBinaryPath.trim() || null,
          ollama: {
            enabled: ollamaEnabled,
            model: ollamaEnabled ? (ollamaModel || null) : null,
          },
        },
      };

      const res = await fetch("/api/daemon", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      // Save custom engine env to cli-engine/.env
      if (engineType === "custom") {
        await fetch("/api/settings/custom-engine-env", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            CUSTOM_ENGINE_API_KEY: customApiKey.trim() || null,
            CUSTOM_ENGINE_BASE_URL: customBaseUrl.trim() || null,
          }),
        });
      }

      showSuccess("Settings saved");
      setDirty(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Settings" }]} />
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--accent)] flex items-center justify-center">
            <Settings className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure the agent engine and local LLM integration</p>
          </div>
        </div>

        {/* Agent Engine Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4" />
              Agent Engine
            </CardTitle>
            <CardDescription>
              Choose which engine the daemon uses to execute agent tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={engineType} onValueChange={(v) => { setEngineType(v); setDirty(true); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select engine" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect (Recommended)</SelectItem>
                <SelectItem value="opencode">OpenCode</SelectItem>
                <SelectItem value="claude">Claude Code</SelectItem>
                <SelectItem value="custom">Custom Engine</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Custom CLI Engine — only shown when engineType === "custom" */}
        {engineType === "custom" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wrench className="h-4 w-4" />
                Custom CLI Engine
              </CardTitle>
              <CardDescription>
                Path to your custom engine binary or script. Must accept <code>-p</code>, <code>--output-format json</code>, and <code>--max-turns N</code> flags.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="./cli-engine/run.sh"
                value={agentBinaryPath}
                onChange={(e) => { setAgentBinaryPath(e.target.value); setDirty(true); }}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>
        )}

        {/* Custom Engine API Config — only shown when engineType === "custom" */}
        {engineType === "custom" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Key className="h-4 w-4" />
                API Credentials
              </CardTitle>
              <CardDescription>
                API key and base URL for the custom engine. Stored in <code>cli-engine/.env</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">API Key</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={customApiKey}
                  onChange={(e) => { setCustomApiKey(e.target.value); setDirty(true); }}
                  className="font-mono text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-sm flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Base URL
                </Label>
                <Input
                  placeholder="https://openrouter.ai/api/v1"
                  value={customBaseUrl}
                  onChange={(e) => { setCustomBaseUrl(e.target.value); setDirty(true); }}
                  className="font-mono text-sm mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  OpenAI-compatible endpoint. Leave empty to use OpenRouter.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Local LLMs (Ollama) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4" />
              Local LLMs (Ollama)
            </CardTitle>
            <CardDescription>
              Use locally installed Ollama models via the OpenAI-compatible API at <code>http://localhost:11434</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="ollama-toggle" className="text-sm">Enable Ollama integration</Label>
              <Switch
                id="ollama-toggle"
                checked={ollamaEnabled}
                onCheckedChange={(v) => { setOllamaEnabled(v); setDirty(true); }}
              />
            </div>

            {ollamaEnabled && (
              <div className="space-y-3 pt-2 border-t border-border">
                <Label className="text-sm">Select Model</Label>

                {fetchingModels && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Fetching installed models...
                  </div>
                )}

                {modelsError && (
                  <div className="flex items-center gap-2 text-sm text-[var(--destructive)]">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {modelsError}
                  </div>
                )}

                {availableModels.length > 0 && !fetchingModels && (
                  <Select value={ollamaModel} onValueChange={(v) => { setOllamaModel(v); setDirty(true); }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {availableModels.length === 0 && !fetchingModels && !modelsError && (
                  <p className="text-sm text-muted-foreground">
                    No models found. Make sure Ollama is running and you have pulled models.
                  </p>
                )}

                {!ollamaModel && availableModels.length > 0 && !fetchingModels && (
                  <Input
                    placeholder="Or type a model name manually..."
                    value={ollamaModel}
                    onChange={(e) => { setOllamaModel(e.target.value); setDirty(true); }}
                    className="font-mono text-sm"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
