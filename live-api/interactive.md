Interactive conversations with the Live API

To see an example of Live API, run the "Getting Started with the Live API Native Audio" notebook in one of the following environments:

Open in Colab | Open in Colab Enterprise | Open in Vertex AI Workbench | View on GitHub

The Live API enables low-latency, two-way voice and video interactions with Gemini.

This guide covers how to set up a two-way interactive conversation, adjust audio settings, manage sessions, and more.
Supported models

You can use the Live API with the following models:
Model version 	Availability level
gemini-live-2.5-flash 	Private GA*
gemini-live-2.5-flash-preview-native-audio 	Public preview
gemini-live-2.5-flash-preview-native-audio-09-2025 	Public preview

* Reach out to your Google account team representative to request access.
Start a conversation
Console
Python
Python

    Open Vertex AI Studio > Stream realtime.
    Click mic Start session to initiate the conversation.

To end the session, click stop_circleStop session.
Change language and voice settings

The Live API uses Chirp 3 to support synthesized speech responses in a variety of HD voices and languages. For a full list and demos of each voice, see Chirp 3: HD voices.

To set the response voice and language:
Console
Python

    Open Vertex AI Studio > Stream realtime.
    In the Outputs expander, select a voice from the Voice drop-down.
    In the same expander, select a language from the Language drop-down.
    Click mic Start session to start the session.

Tip: For the best results when prompting and requiring the model to respond in a non-English language, include the following as part of your system instructions:

RESPOND IN LANGUAGE

. YOU MUST RESPOND UNMISTAKABLY IN LANGUAGE

.
    

Change voice activity detection settings

Voice activity detection (VAD) allows the model to recognize when a person is speaking. This is essential for creating natural conversations, as it allows a user to interrupt the model at any time.

The model automatically performs voice activity detection (VAD) on a continuous audio input stream. You can configure the VAD settings using the realtimeInputConfig.automaticActivityDetection field of the setup message. When VAD detects an interruption, the ongoing generation is canceled and discarded. Only the information already sent to the client is retained in the session history. The server then sends a message to report the interruption.

If the audio stream pauses for more than a second (for example, if the user turns off the microphone), send an audioStreamEnd event to flush any cached audio. The client can resume sending audio data at any time.

Alternatively, disable automatic VAD by setting realtimeInputConfig.automaticActivityDetection.disabled to true in the setup message. With this configuration, the client detects user speech and sends activityStart and activityEnd messages at the appropriate times. An audioStreamEnd isn't sent. Interruptions are marked by activityEnd.
Python

config = LiveConnectConfig(
    response_modalities=["TEXT"],
    realtime_input_config=RealtimeInputConfig(
        automatic_activity_detection=AutomaticActivityDetection(
            disabled=False,  # default
            start_of_speech_sensitivity=StartSensitivity.START_SENSITIVITY_LOW, # Either START_SENSITIVITY_LOW or START_SENSITIVITY_HIGH
            end_of_speech_sensitivity=EndSensitivity.END_SENSITIVITY_LOW, # Either END_SENSITIVITY_LOW or END_SENSITIVITY_HIGH
            prefix_padding_ms=20,
            silence_duration_ms=100,
        )
    ),
)

async with client.aio.live.connect(
    model=MODEL_ID,
    config=config,
) as session:
    audio_bytes = Path("sample.pcm").read_bytes()

    await session.send_realtime_input(
        media=Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
    )

    # if stream gets paused, send:
    # await session.send_realtime_input(audio_stream_end=True)

    response = []
    async for message in session.receive():
        if message.server_content.interrupted is True:
            # The model generation was interrupted
            response.append("The session was interrupted")

        if message.text:
            response.append(message.text)

    display(Markdown(f"**Response >** {''.join(response)}"))
      

Extend a session
Note: Session extension is only available when using the Gen AI SDK, not Vertex AI Studio.

The default maximum length of a conversation session is 10 minutes. A goAway notification (BidiGenerateContentServerMessage.goAway) is sent to the client 60 seconds before the session ends.

You can extend the session length in 10-minute increments using the Gen AI SDK. There's no limit to the number of times you can extend a session. For an example, see Enable and disable session resumption.
Context window

The Live API context window is used to store real-time streamed data (25 tokens per second (TPS) for audio and 258 TPS for video) and other content, including text inputs and model outputs.

If the context window exceeds the maximum length (set using the Max content size slider in Vertex AI Studio, or trigger_tokens in the API), the oldest turns are truncated using context window compression to prevent abrupt session termination. Context window compression triggers once the context window hits its maximum length (set either in Vertex AI Studio using the Target context size slider, or using target_tokens in the API) and deletes the oldest parts of the conversation until the total token count is back down to this target size.

For example, if your maximum context length is set to 32000 tokens and your target size is set to 16000 tokens:

    Turn 1: The conversation starts. In this example, the request uses 12,000 tokens.
        Total context size: 12,000 tokens
    Turn 2: You make another request. This request uses another 12,000 tokens.
        Total context size: 24,000 tokens
    Turn 3: You make another request. This request uses 14,000 tokens.
        Total context size: 38,000 tokens

Since the total context size is now higher than the 32,000 token maximum, context window compression now triggers. The system goes back to the beginning of the conversation and starts deleting old turns until the total token size is less than the 16,000 token target:

    It deletes Turn 1 (12,000 tokens). The total is now 26,000 tokens, which is still higher than the 16,000 token target.
    It deletes Turn 2 (12,000 tokens). The total is now 14,000 tokens.

The final result is that only Turn 3 remains in active memory, and the conversation continues from that point.

The minimum and maximum lengths for the context length and target size are:
Setting (API flag) 	Minimum value 	Maximum value
Maximum context length (trigger_tokens) 	5,000 	128,000
Target context size (target_tokens) 	0 	128,000

To set the context window:
Console
Python

    Open Vertex AI Studio > Stream realtime.
    Click to open the Advanced menu.
    In the Session Context section, use the Max context size slider to set the context size to a value between 5,000 and 128,000.
    (Optional) In the same section, use the Target context size slider to set the target size to a value between 0 and 128,000.

Concurrent sessions

You can have up to 1,000 concurrent sessions per project.
Update system instructions during a session

The Live API lets you update the system instructions during an active session. Use this to adapt the model's responses, such as changing the response language or modifying the tone.

To update the system instructions mid-session, you can send text content with the system role. The updated system instruction will remain in effect for the remaining session.
Python

session.send_client_content(
      turns=types.Content(
          role="system", parts=[types.Part(text="new system instruction")]
      ),
      turn_complete=False
  )
      

Enable and disable session resumption

Session resumption lets you reconnect to a previous session within 24 hours. This is achieved by storing cached data, including text, video, audio prompts, and model outputs. Project-level privacy is enforced for this cached data.

By default, session resumption is disabled.
Important: If you need to ensure zero data retention in your application, don't enable session resumption.

To enable the session resumption feature, set the sessionResumption field of the BidiGenerateContentSetup message. If enabled, the server will periodically take a snapshot of the current cached session contexts, and store it in the internal storage.

When a snapshot is successfully taken, a resumptionUpdate is returned with the handle ID that you can record and use later to resume the session from the snapshot.

Here's an example of enabling session resumption and retrieving the handle ID:
Python

import asyncio
from google import genai
from google.genai import types

client = genai.Client(
    vertexai=True,
    project=GOOGLE_CLOUD_PROJECT

,
    location=GOOGLE_CLOUD_LOCATION

,
)
model = "gemini-live-2.5-flash"

async def main():
    print(f"Connecting to the service with handle {previous_session_handle}...")
    async with client.aio.live.connect(
        model=model,
        config=types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            session_resumption=types.SessionResumptionConfig(
                # The handle of the session to resume is passed here,
                # or else None to start a new session.
                handle=previous_session_handle
            ),
        ),
    ) as session:
        while True:
            await session.send_client_content(
                turns=types.Content(
                    role="user", parts=[types.Part(text="Hello world!")]
                )
            )
            async for message in session.receive():
                # Periodically, the server will send update messages that may
                # contain a handle for the current state of the session.
                if message.session_resumption_update:
                    update = message.session_resumption_update
                    if update.resumable and update.new_handle:
                        # The handle should be retained and linked to the session.
                        return update.new_handle

                # For the purposes of this example, placeholder input is continually fed
                # to the model. In non-sample code, the model inputs would come from
                # the user.
                if message.server_content and message.server_content.turn_complete:
                    break

if __name__ == "__main__":
    asyncio.run(main())
      

To achieve seamless session resumption, enable transparent mode:
Python

types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            session_resumption=types.SessionResumptionConfig(
                transparent=True,
    ),
)
      

After transparent mode is enabled, the index of the client message that corresponds with the context snapshot is explicitly returned. This helps identify which client message you need to send again, when you resume the session from the resumption handle.