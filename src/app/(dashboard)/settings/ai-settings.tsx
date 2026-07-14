"use client";

import * as React from "react";
import { Bot, CheckCircle2, KeyRound, Loader2, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PublicConfig = {
  configured: boolean;
  baseUrl: string;
  model: string;
  source: "database" | "environment" | "none";
};

export function AiSettings({ initial }: { initial: PublicConfig }) {
  const [config, setConfig] = React.useState(initial);
  const [apiKey, setApiKey] = React.useState("");
  const [baseUrl, setBaseUrl] = React.useState(initial.baseUrl);
  const [model, setModel] = React.useState(initial.model);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey || undefined, baseUrl, model }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save settings.");
      setConfig(data.config);
      setApiKey("");
      setMessage({ ok: true, text: "AI settings saved securely." });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Unable to save settings." });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/ai", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Connection failed.");
      setMessage({ ok: true, text: `${data.message} (${data.model})` });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Connection failed." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>DeepSeek AI</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Ranks verified businesses during location-based lead discovery.
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              config.configured
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {config.configured ? `Connected via ${config.source}` : "Not configured"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-base-url">API base URL</Label>
            <Input
              id="ai-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.deepseek.com/v1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-model">Model identifier</Label>
            <Input
              id="ai-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="deepseek-chat"
            />
            <p className="text-xs text-muted-foreground">
              Enter the exact V4 Flash identifier shown by your provider when available.
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-key">API key</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ai-key"
              type="password"
              autoComplete="new-password"
              className="pl-9"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={config.configured ? "Leave blank to keep the saved key" : "sk-…"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Stored encrypted with AES-256-GCM. It is never returned to the browser.
          </p>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              message.ok
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {message.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {message.text}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving || !baseUrl.trim() || !model.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save AI settings
          </Button>
          <Button variant="outline" onClick={test} disabled={testing || !config.configured}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
            Test connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
