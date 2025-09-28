'use client';

import { useCallback } from "react";
import { useAppMessage, useDailyEvent } from "@daily-co/daily-react";

type AppMessageUtterance = {
  "message_type": "conversation",
  "event_type": "conversation.utterance",
  "conversation_id": string,
  "inference_id": string,
  "properties": {
    "role": "user" | "replica",
    "speech": string,
    "visual_context": string
  }
}

type AppMessageToolCall<T> = {
  "message_type": "conversation",
  "event_type": "conversation.tool_call",
  "conversation_id": string,
  "inference_id": string,
  "properties": T
}

type AppMessagePerceptionToolCall<T> = {
  "message_type": "conversation",
  "event_type": "conversation.perception_tool_call",
  "conversation_id": string,
  "properties": T
}

type AppMessagePerceptionAnalysis = {
  "message_type": "conversation",
  "event_type": "conversation.perception_analysis",
  "conversation_id": string,
  "properties": {
    "analysis": string
  }
}

type AppMessageReplicaStartedSpeaking = {
  "message_type": "conversation",
  "event_type": "conversation.replica.started_speaking",
  "inference_id": string
}

type AppMessageReplicaStoppedSpeaking = {
  "message_type": "conversation",
  "event_type": "conversation.replica.stopped_speaking",
  "inference_id": string
}

type AppMessageUserStartedSpeaking = {
  "message_type": "conversation",
  "event_type": "conversation.user.started_speaking",
  "inference_id": string
}

type AppMessageUserStoppedSpeaking = {
  "message_type": "conversation",
  "event_type": "conversation.user.stopped_speaking",
  "inference_id": string
}

type AppMessageReplicaInterrupted = {
  "message_type": "conversation",
  "event_type": "conversation.replica_interrupted",
  "conversation_id": string,
  "inference_id": string
}

type AppMessage<T> = {
  data: AppMessageUtterance |
  AppMessageToolCall<T> |
  AppMessagePerceptionToolCall<T> |
  AppMessagePerceptionAnalysis |
  AppMessageReplicaStartedSpeaking |
  AppMessageReplicaStoppedSpeaking |
  AppMessageUserStartedSpeaking |
  AppMessageUserStoppedSpeaking |
  AppMessageReplicaInterrupted
};

export function useObservableEvent<T>(callback: (event: AppMessage<T>['data']) => void): void {
  return useDailyEvent(
    "app-message",
    useCallback(
      (event: AppMessage<T>) => {
        callback(event.data);
      },
      [callback],
    ),
  )
}

type AppMessageEcho = {
  "message_type": "conversation",
  "event_type": "conversation.echo",
  "conversation_id": string,
  "properties": {
    "modality": "audio" | "text",
    "text"?: string,
    "audio"?: string,
    "sample_rate"?: number,
    "inference_id"?: string,
    "done"?: boolean
  }
}

type AppMessageRespond = {
  "message_type": "conversation",
  "event_type": "conversation.respond",
  "conversation_id": string,
  "properties": {
    "text": string
  }
}

type AppMessageInterrupt = {
  "message_type": "conversation",
  "event_type": "conversation.interrupt",
  "conversation_id": string
}

type AppMessageOverwriteLlmContext = {
  "message_type": "conversation",
  "event_type": "conversation.overwrite_llm_context",
  "conversation_id": string,
  "properties": {
    "context": string
  }
}

type AppMessageAppendLlmContext = {
  "message_type": "conversation",
  "event_type": "conversation.append_llm_context",
  "conversation_id": string,
  "properties": {
    "context": string
  }
}

type Sensitivity = "superlow" | "verylow" | "low" | "medium" | "high" | "auto"

type AppMessageSensitivity = {
  "message_type": "conversation",
  "event_type": "conversation.sensitivity",
  "conversation_id": string,
  "properties": {
    "participant_pause_sensitivity": Sensitivity,
    "participant_interrupt_sensitivity": Sensitivity
  }
}

type SendAppMessageProps =
  AppMessageEcho |
  AppMessageRespond |
  AppMessageInterrupt |
  AppMessageOverwriteLlmContext |
  AppMessageAppendLlmContext |
  AppMessageSensitivity

export function useSendAppMessage(): (message: SendAppMessageProps) => void {
  const sendAppMessage = useAppMessage();

  return useCallback((message: SendAppMessageProps) => {
    sendAppMessage(message, '*');
  }, [sendAppMessage]);
}