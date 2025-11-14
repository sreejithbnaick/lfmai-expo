package com.anonymous.lfmaiexpo

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.onCompletion
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collect
import ai.liquid.leap.LeapClient
import ai.liquid.leap.LeapModelLoadingException
import ai.liquid.leap.ModelRunner
import ai.liquid.leap.Conversation
import ai.liquid.leap.message.MessageResponse

class LeapSDKModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val TAG = "LeapSDKModule"
    private var modelRunner: ModelRunner? = null
    private var currentConversation: Conversation? = null
    private var generationJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    override fun getName(): String {
        return "LeapSDK"
    }

    @ReactMethod
    fun loadModel(modelPath: String, promise: Promise) {
        scope.launch {
            try {
                modelRunner = LeapClient.loadModel(modelPath)
                promise.resolve(true)
                Log.d(TAG, "Model loaded successfully from: $modelPath")
            } catch (e: LeapModelLoadingException) {
                val errorMsg = "Failed to load model: ${e.message}"
                Log.e(TAG, errorMsg, e)
                promise.reject("MODEL_LOAD_ERROR", errorMsg, e)
            } catch (e: Exception) {
                val errorMsg = "Unexpected error loading model: ${e.message}"
                Log.e(TAG, errorMsg, e)
                promise.reject("UNKNOWN_ERROR", errorMsg, e)
            }
        }
    }

    @ReactMethod
    fun createConversation(promise: Promise) {
        try {
            val runner = modelRunner
            if (runner == null) {
                promise.reject("NO_MODEL", "Model not loaded. Call loadModel first.")
                return
            }
            currentConversation = runner.createConversation()
            promise.resolve(true)
            Log.d(TAG, "Conversation created successfully")
        } catch (e: Exception) {
            val errorMsg = "Failed to create conversation: ${e.message}"
            Log.e(TAG, errorMsg, e)
            promise.reject("CONVERSATION_ERROR", errorMsg, e)
        }
    }

    @ReactMethod
    fun generateResponse(input: String, promise: Promise) {
        val conversation = currentConversation
        if (conversation == null) {
            promise.reject("NO_CONVERSATION", "No conversation created. Call createConversation first.")
            return
        }

        generationJob?.cancel()
        
        generationJob = scope.launch {
            val responseBuilder = StringBuilder()
            conversation.generateResponse(input).onEach { response ->
                when (response) {
                    is MessageResponse.Chunk -> {
                        Log.d(TAG, "text chunk: ${response.text}")
                        responseBuilder.append(response.text)
                            sendEvent("onChunk", createMap().apply {
                                putString("text", response.text)
                                putString("type", "chunk")
                        })
                    }
                    is MessageResponse.ReasoningChunk -> {
                        Log.d(TAG, "reasoning chunk: ${response.toString()}")
                        sendEvent("onChunk", createMap().apply {
                            putString("text", response.toString())
                            putString("type", "reasoning")
                        })
                    }
                    else -> {
                        // ignore other response
                    }
                }
            }.onCompletion { cause ->
                Log.d(TAG, "Generation done!")
                if (cause == null) {
                    val fullResponse = responseBuilder.toString()
                    sendEvent("onComplete", createMap().apply {
                        putString("text", fullResponse)
                    })
                    promise.resolve(createMap().apply {
                        putString("text", fullResponse)
                    })
                } else {
                    val errorMsg = "Error in generation: ${cause.message}"
                    Log.e(TAG, errorMsg, cause)
                    sendEvent("onError", createMap().apply {
                        putString("error", errorMsg)
                    })
                    promise.reject("GENERATION_ERROR", errorMsg, cause)
                }
            }.catch { exception ->
                Log.e(TAG, "Error in generation: $exception")
                
                val errorMsg = "Error in generation: ${exception.message}"
                Log.e(TAG, errorMsg, exception)
                sendEvent("onError", createMap().apply {
                    putString("error", errorMsg)
                })
                promise.reject("GENERATION_ERROR", errorMsg, exception)
            }.collect()
        }
    }

    @ReactMethod
    fun cancelGeneration(promise: Promise) {
        try {
            generationJob?.cancel()
            generationJob = null
            promise.resolve(true)
            Log.d(TAG, "Generation cancelled")
        } catch (e: Exception) {
            val errorMsg = "Failed to cancel generation: ${e.message}"
            Log.e(TAG, errorMsg, e)
            promise.reject("CANCEL_ERROR", errorMsg, e)
        }
    }

    @ReactMethod
    fun getHistory(promise: Promise) {
        try {
            val conversation = currentConversation
            if (conversation == null) {
                promise.resolve(createMap().apply {
                    putArray("messages", Arguments.createArray())
                })
                return
            }

            val history = conversation.history
            val messagesArray = Arguments.createArray()
            
            promise.resolve(createMap().apply {
                putArray("messages", messagesArray)
            })
        } catch (e: Exception) {
            val errorMsg = "Failed to get history: ${e.message}"
            Log.e(TAG, errorMsg, e)
            promise.reject("HISTORY_ERROR", errorMsg, e)
        }
    }

    @ReactMethod
    fun cleanup(promise: Promise) {
        try {
            generationJob?.cancel()
            generationJob = null
            currentConversation = null
            modelRunner = null
            promise.resolve(true)
            Log.d(TAG, "Cleanup completed")
        } catch (e: Exception) {
            val errorMsg = "Failed to cleanup: ${e.message}"
            Log.e(TAG, errorMsg, e)
            promise.reject("CLEANUP_ERROR", errorMsg, e)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun createMap(): WritableMap {
        return Arguments.createMap()
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
        generationJob?.cancel()
    }
}
