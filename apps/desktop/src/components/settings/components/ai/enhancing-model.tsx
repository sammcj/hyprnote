import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Languages, Server } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import path from 'path';

import { commands as localLlmCommands } from "@hypr/plugin-local-llm";
import { Button } from "@hypr/ui/components/ui/button";
import { Label } from "@hypr/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@hypr/ui/components/ui/radio-group";
import { Spinner } from "@hypr/ui/components/ui/spinner";

interface EnhancingModelProps {
  isRunning: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
}

export function EnhancingModel({
  isRunning,
  queryClient,
}: EnhancingModelProps) {
  const [selectedModel, setSelectedModel] = useState("default");
  const [customModelPath, setCustomModelPath] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get the active model path
  const activeModelPath = useQuery({
    queryKey: ["local-llm", "active-model"],
    queryFn: async () => {
      try {
        return await localLlmCommands.getActiveModelPath()
      } catch (error) {
        console.error("Failed to get active model path:", error)
        return null
      }
    },
    refetchInterval: 5000,
  })

  // Get available GGUF models
  const availableGgufModels = useQuery({
    queryKey: ["local-llm", "gguf-models"],
    queryFn: async () => {
      try {
        const models = await localLlmCommands.listAvailableGgufModels()
        return models.map((modelPath: string) => ({
          path: modelPath,
          name: path.basename(modelPath)
        }))
      } catch (error) {
        console.error("Failed to fetch GGUF models:", error)
        return []
      }
    },
  })

  // Set the selected model based on the active path
  useEffect(() => {
    if (activeModelPath.data) {
      const modelName = path.basename(activeModelPath.data)
      setSelectedModel(modelName)
      setCustomModelPath(activeModelPath.data)
    }
  }, [activeModelPath.data]);

  const toggleLocalLlm = useMutation({
    mutationFn: async () => {
      if (!isRunning) {
        await localLlmCommands.startServer();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local-llm", "running"] });
    },
  });

  const ollamaModels = useQuery({
    queryKey: ["ollama", "models"],
    queryFn: async () => {
      try {
        const models = await localLlmCommands.listOllamaModels();
        return models.length > 0 ? models : ["default"];
      } catch (error) {
        console.error("Failed to fetch Ollama models:", error);
        return ["default"];
      }
    },
    enabled: isRunning,
  });

  const connectToOllama = useMutation({
    mutationFn: async () => {
      // This would be the actual connection logic
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ollama", "models"] });
    },
  });

  const selectCustomModel = useMutation({
    mutationFn: async () => {
      try {
        // Trigger file input click instead of calling backend
        if (fileInputRef.current) {
          fileInputRef.current.click()
        }
        return null
      } catch (error) {
        console.error("Failed to select custom model:", error)
        throw error
      }
    }
  })

  const setModelPath = useMutation({
    mutationFn: async (modelPath: string | null) => {
      try {
        await localLlmCommands.setCustomModelPath(modelPath)

        // Invalidate queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ["local-llm", "active-model"] })
        queryClient.invalidateQueries({ queryKey: ["local-llm", "running"] })

        return true
      } catch (error) {
        console.error("Failed to set model path:", error)
        throw error
      }
    }
  })

  const handleModelChange = (modelName: string) => {
    setSelectedModel(modelName)

    // If it's a built-in model from the list
    const selectedModelObject = availableGgufModels.data?.find(m => path.basename(m.path) === modelName)
    if (selectedModelObject) {
      setModelPath.mutate(selectedModelObject.path)
    } else if (modelName === "default") {
      // Reset to default model (passing null clears the custom path)
      setModelPath.mutate(null)
    }
  }

  const handleFileSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    // Access file path using the Tauri-specific property
    const filePath = (file as any).path

    if (filePath) {
      setCustomModelPath(filePath)
      setSelectedModel(path.basename(filePath))
      setModelPath.mutate(filePath)
    }

    // Reset the input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [setModelPath]);

  const availableModels = ollamaModels.data || ["default"];
  const isOllamaConnected = ollamaModels.data && ollamaModels.data.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-sm font-medium">
            <Languages className="h-4 w-4" />
            <Trans>Enhancing Model</Trans>
          </div>
          <div className="flex items-center gap-2">
            {isRunning
              ? (
                <div className="flex items-center gap-1.5">
                  <div className="relative h-2 w-2">
                    <div className="absolute inset-0 rounded-full bg-green-500/30"></div>
                    <div className="absolute inset-0 rounded-full bg-green-500 animate-ping"></div>
                  </div>
                  <span className="text-xs text-green-600">
                    <Trans>Active</Trans>
                  </span>
                </div>
              )
              : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleLocalLlm.mutate()}
                  disabled={toggleLocalLlm.isPending}
                  className="min-w-20 text-center"
                >
                  {toggleLocalLlm.isPending
                    ? (
                      <>
                        <Spinner />
                        <Trans>Loading...</Trans>
                      </>
                    )
                    : <Trans>Start Server</Trans>}
                </Button>
              )}
          </div>
        </div>

        <div className="mt-2 pl-2">
          <div className="space-y-4">
            {/* GGUF Models Section */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                <Trans>GGUF Models</Trans>
              </h3>

              <RadioGroup
                value={selectedModel}
                onValueChange={handleModelChange}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="default" id="model-default" />
                  <Label
                    htmlFor="model-default"
                    className="flex items-center cursor-pointer"
                  >
                    <span><Trans>Default (Llama-3.2-3B-Instruct)</Trans></span>
                  </Label>
                </div>

                {availableGgufModels.data?.map((model) => (
                  <div key={model.path} className="flex items-center space-x-2">
                    <RadioGroupItem value={model.name} id={`model-${model.name}`} />
                    <Label
                      htmlFor={`model-${model.name}`}
                      className="flex items-center cursor-pointer"
                    >
                      <span>{model.name}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {/* Hidden file input for GGUF model selection */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".gguf"
                onChange={handleFileSelection}
                className="hidden"
              />

              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectCustomModel.mutate()}
                  disabled={selectCustomModel.isPending}
                  className="flex items-center gap-1.5"
                >
                  {selectCustomModel.isPending ? (
                    <Spinner className="h-3 w-3" />
                  ) : (
                    <FolderOpen className="h-3.5 w-3.5" />
                  )}
                  <Trans>Browse for GGUF model...</Trans>
                </Button>

                {customModelPath && selectedModel !== "default" && !availableGgufModels.data?.find(m => path.basename(m.path) === selectedModel) && (
                  <div className="mt-2 text-xs text-muted-foreground break-all">
                    <span>Custom model: {customModelPath}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="border-t border-gray-200 dark:border-gray-700 absolute top-1/2 left-0 right-0"></div>
              <div className="relative flex justify-center">
                <span className="bg-background px-2 text-xs text-muted-foreground">
                  <Trans>or</Trans>
                </span>
              </div>
            </div>

            {/* Ollama Connection Section */}
            {isRunning && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    <span className="text-sm">
                      <Trans>Connect to Ollama</Trans>
                    </span>
                  </div>

                  <Button
                    variant={isOllamaConnected ? "outline" : "default"}
                    size="sm"
                    onClick={() => !isOllamaConnected && connectToOllama.mutate()}
                    disabled={ollamaModels.isLoading || connectToOllama.isPending}
                    className="w-20 text-center"
                  >
                    {ollamaModels.isLoading || connectToOllama.isPending
                      ? (
                        <>
                          <Spinner className="mr-1 h-3 w-3" />
                          <Trans>Connecting...</Trans>
                        </>
                      )
                      : isOllamaConnected
                        ? <Trans>Connected</Trans>
                        : <Trans>Connect</Trans>}
                  </Button>
                </div>

                {/* Ollama Models Section */}
                {isOllamaConnected && availableModels.length > 0 && (
                  <div className="pl-6 space-y-2">
                    <RadioGroup
                      value={selectedModel}
                      onValueChange={setSelectedModel}
                      disabled={ollamaModels.isLoading}
                      className="space-y-2"
                    >
                      {availableModels.map((model) => (
                        <div key={model} className="flex items-center space-x-2">
                          <RadioGroupItem value={model} id={`ollama-model-${model}`} />
                          <Label
                            htmlFor={`ollama-model-${model}`}
                            className="flex items-center cursor-pointer"
                          >
                            <span>{model}</span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
