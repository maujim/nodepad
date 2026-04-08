"use client"

import { useState, useEffect, useCallback } from "react"

export interface AIModel {
  id: string
  label: string
  shortLabel: string
  description: string
  supportsGrounding: boolean
  /** For OpenAI models: the search-preview variant to use when grounding is enabled */
  groundingModelId?: string
}

export type AIProvider = "openrouter" | "openai" | "zai"

export interface AIProviderPreset {
  id: AIProvider
  label: string
  baseUrl: string
  keyUrl: string
  keyPlaceholder: string
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/settings/keys",
    keyPlaceholder: "sk-or-v1-...",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
  {
    id: "zai",
    label: "Z.ai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    keyPlaceholder: "Your Z.ai API key",
  },
]

export function getPreset(provider: AIProvider): AIProviderPreset {
  return AI_PROVIDER_PRESETS.find(p => p.id === provider) || AI_PROVIDER_PRESETS[0]
}

export const AI_MODELS: AIModel[] = [
  {
    id: "openrouter/free",
    label: "OpenRouter Free",
    shortLabel: "Free",
    description: "Default free-tier model routing via OpenRouter",
    supportsGrounding: false,
  },
]

export const OPENAI_MODELS: AIModel[] = [
  {
    id: "gpt-4o",
    label: "GPT-4o",
    shortLabel: "GPT-4o",
    description: "Strong structured output, broad knowledge",
    supportsGrounding: true,
    groundingModelId: "gpt-4o-search-preview",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    shortLabel: "GPT-4o Mini",
    description: "Fast and capable, web grounding available",
    supportsGrounding: true,
    groundingModelId: "gpt-4o-mini-search-preview",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    shortLabel: "GPT-4.1",
    description: "Latest GPT-4, improved instruction following",
    supportsGrounding: false,
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    shortLabel: "GPT-4.1 Mini",
    description: "Fast and capable, good balance",
    supportsGrounding: false,
  },
  {
    id: "o4-mini",
    label: "o4-mini",
    shortLabel: "o4-mini",
    description: "Fast reasoning model",
    supportsGrounding: false,
  },
]

export const ZAI_MODELS: AIModel[] = [
  {
    id: "glm-4.5",
    label: "GLM-4.5",
    shortLabel: "GLM-4.5",
    description: "Fast, cost-efficient Z.ai model",
    supportsGrounding: false,
  },
  {
    id: "glm-4.7",
    label: "GLM-4.7",
    shortLabel: "GLM-4.7",
    description: "Strong reasoning, 200K context",
    supportsGrounding: false,
  },
  {
    id: "glm-5",
    label: "GLM-5",
    shortLabel: "GLM-5",
    description: "Z.ai flagship model",
    supportsGrounding: false,
  },
  {
    id: "glm-5-turbo",
    label: "GLM-5 Turbo",
    shortLabel: "GLM-5 Turbo",
    description: "Fast, capable, community tested",
    supportsGrounding: false,
  },
]

export function getModelsForProvider(provider: AIProvider): AIModel[] {
  if (provider === "openai") return OPENAI_MODELS
  if (provider === "zai")    return ZAI_MODELS
  return AI_MODELS // OpenRouter uses dynamic free-model discovery in the UI
}

export interface OpenRouterModelResponse {
  data?: Array<{ id?: string; name?: string }>
}

/**
 * Fetches OpenRouter models and keeps only free-tier IDs.
 * Equivalent to: for model in response.data: if model.id endswith(':free'): keep it
 */
export async function fetchOpenRouterFreeModels(): Promise<AIModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models")
  if (!res.ok) {
    throw new Error(`OpenRouter models fetch failed (${res.status})`)
  }

  const json = await res.json() as OpenRouterModelResponse
  const rows = Array.isArray(json.data) ? json.data : []

  const mapped = rows
    .filter((m) => typeof m.id === "string" && m.id.toLowerCase().endsWith(":free"))
    .map((m): AIModel => {
      const id = m.id as string
      const short = id.split("/").pop() || id
      return {
        id,
        label: m.name || id,
        shortLabel: short,
        description: "OpenRouter free model",
        supportsGrounding: false,
      }
    })

  // Stable order for consistent UX
  mapped.sort((a, b) => a.id.localeCompare(b.id))
  return mapped
}

export const DEFAULT_MODEL_ID = "openrouter/free"
export const DEFAULT_PROVIDER: AIProvider = "openrouter"

export interface AISettings {
  apiKey: string
  modelId: string
  webGrounding: boolean
  provider: AIProvider
  customBaseUrl: string
  /** Per-provider key store so switching back to a provider restores its key */
  providerKeys?: Partial<Record<AIProvider, string>>
}

const STORAGE_KEY = "nodepad-ai-settings"

function loadSettings(): AISettings {
  if (typeof window === "undefined") {
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "", ...JSON.parse(raw) }
  } catch {
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
  }
}

export interface AIConfig {
  apiKey: string
  modelId: string
  supportsGrounding: boolean
  provider: AIProvider
  customBaseUrl: string
}

export function loadAIConfig(): AIConfig | null {
  const s = loadSettings()
  if (!s.apiKey) return null

  // OpenRouter models are discovered dynamically in the client UI.
  // Keep the saved model ID verbatim so dynamic free-model IDs work.
  if (s.provider === "openrouter") {
    const modelId = s.modelId?.toLowerCase().endsWith(":free") ? s.modelId : DEFAULT_MODEL_ID
    return {
      apiKey: s.apiKey,
      modelId,
      supportsGrounding: false,
      provider: s.provider,
      customBaseUrl: s.customBaseUrl,
    }
  }

  const models = getModelsForProvider(s.provider)
  const model = models.find(m => m.id === s.modelId)
  const modelId = model?.id ?? models[0]?.id ?? s.modelId ?? DEFAULT_MODEL_ID
  const supportsGrounding =
    s.provider === "openai" &&
    s.webGrounding &&
    (model?.supportsGrounding ?? false)

  return { apiKey: s.apiKey, modelId, supportsGrounding, provider: s.provider, customBaseUrl: s.customBaseUrl }
}

export function getBaseUrl(config: AIConfig): string {
  return getPreset(config.provider).baseUrl
}

export function getProviderHeaders(config: AIConfig): Record<string, string> {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
  }
  if (config.provider === "openrouter") {
    base["HTTP-Referer"] = "https://nodepad.space"
    base["X-Title"] = "nodepad"
  }
  return base
}

/** @deprecated Use loadAIConfig() for direct browser → provider calls.
 *  Kept for any remaining server-route usage during transition. */
export function getAIHeaders(): Record<string, string> {
  const config = loadAIConfig()
  if (!config) return {}
  const models = getModelsForProvider(config.provider)
  const model = models.find(m => m.id === config.modelId) || AI_MODELS.find(m => m.id === DEFAULT_MODEL_ID)!
  return {
    "x-or-key": config.apiKey,
    "x-or-model": config.modelId,
    "x-or-supports-grounding": model.supportsGrounding ? "true" : "false",
  }
}

export function useAISettings() {
  // Always start with the SSR-safe default so server and client render identically.
  // Load the real localStorage value after mount to avoid hydration mismatches
  // caused by settings.apiKey toggling conditional DOM blocks (API key banner,
  // modelLabel prop, etc.) between the server render and client hydration.
  const [settings, setSettings] = useState<AISettings>({
    apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false,
    provider: DEFAULT_PROVIDER, customBaseUrl: "",
  })

  useEffect(() => {
    setSettings(loadSettings())
  }, [])

  const updateSettings = useCallback((patch: Partial<AISettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const models = getModelsForProvider(settings.provider)

  const resolvedModelId = (() => {
    const model = models.find(m => m.id === settings.modelId) || models[0]
    if (!model) return settings.modelId
    if (settings.provider === "openrouter" && settings.webGrounding && model.supportsGrounding) {
      return `${model.id}:online`
    }
    return model.id
  })()

  const currentModel: AIModel = models.find(m => m.id === settings.modelId) || models[0] || {
    id: settings.modelId,
    label: settings.modelId,
    shortLabel: settings.modelId.split("/").pop() || settings.modelId,
    description: "Custom model",
    supportsGrounding: false,
  }

  return { settings, updateSettings, resolvedModelId, currentModel, models }
}
