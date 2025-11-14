/**
 * Leap Liquid AI Service
 * 
 * This service handles integration with Leap Liquid AI Android SDK.
 * The SDK requires a model bundle to be loaded from the device storage.
 * 
 * To use:
 * 1. Download a model bundle from https://leap.liquid.ai/models
 * 2. Push it to the device: adb push model.bundle /data/local/tmp/leap/model.bundle
 * 3. Call initialize() with the model path
 * 4. Call createConversation() to start a new conversation
 * 5. Use sendMessage() to generate responses
 */

import LeapSDK from '../modules/LeapSDK';

interface ChunkEvent {
  text: string;
  type: 'chunk' | 'reasoning';
}

interface GenerationCallbacks {
  onChunk?: (chunk: ChunkEvent) => void;
  onComplete?: (complete: { text: string }) => void;
  onError?: (error: { error: string }) => void;
}

class LeapLiquidAIService {
  private isInitialized = false;
  private modelPath: string | null = null;
  private conversationCreated = false;

  /**
   * Initialize the Leap Liquid AI SDK by loading a model bundle
   * @param modelPath Path to the model bundle file (e.g., "/data/local/tmp/leap/model.bundle")
   */
  async initialize(modelPath: string = '/data/local/tmp/leap/model.bundle'): Promise<void> {
    try {
      if (this.isInitialized) {
        console.warn('Leap Liquid AI is already initialized');
        return;
      }

      this.modelPath = modelPath;
      await LeapSDK.loadModel(modelPath);
      this.isInitialized = true;
      console.log('Leap Liquid AI initialized successfully with model:', modelPath);
    } catch (error) {
      console.error('Failed to initialize Leap Liquid AI:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Check if the SDK is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Create a new conversation
   * This must be called before sending messages
   */
  async createConversation(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Leap Liquid AI is not initialized. Call initialize() first.');
    }

    try {
      await LeapSDK.createConversation();
      this.conversationCreated = true;
      console.log('Conversation created successfully');
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }

  /**
   * Send a message to the AI and get a response
   * @param userMessage The user's message
   * @param callbacks Optional callbacks for streaming responses
   * @returns Promise that resolves with the complete response text
   */
  async sendMessage(
    userMessage: string,
    callbacks?: GenerationCallbacks
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Leap Liquid AI is not initialized. Call initialize() first.');
    }

    if (!this.conversationCreated) {
      throw new Error('No conversation created. Call createConversation() first.');
    }

    try {
      const response = await LeapSDK.generateResponse(
        userMessage,
        callbacks?.onChunk,
        callbacks?.onComplete,
        callbacks?.onError
      );
      return response.text;
    } catch (error) {
      console.error('Error sending message to Leap Liquid AI:', error);
      throw error;
    }
  }

  /**
   * Cancel the current generation
   */
  async cancelGeneration(): Promise<void> {
    try {
      await LeapSDK.cancelGeneration();
    } catch (error) {
      console.error('Error cancelling generation:', error);
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  async getHistory(): Promise<{ messages: any[] }> {
    if (!this.isInitialized) {
      throw new Error('Leap Liquid AI is not initialized. Call initialize() first.');
    }

    try {
      return await LeapSDK.getHistory();
    } catch (error) {
      console.error('Error getting history:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources when done
   */
  async cleanup(): Promise<void> {
    try {
      await LeapSDK.cleanup();
      this.isInitialized = false;
      this.conversationCreated = false;
      this.modelPath = null;
      console.log('Leap Liquid AI cleaned up successfully');
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const leapLiquidAI = new LeapLiquidAIService();

