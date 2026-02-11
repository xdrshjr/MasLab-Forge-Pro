/**
 * Peer Takeover Coordinator
 *
 * Enables agents to help each other by taking over tasks when
 * a peer agent encounters persistent failures.
 */

import type { MessageBus } from '../communication/index.js'
import type { AgentPool } from '../agents/agent-pool.js'
import { MessageType, AgentStatus } from '../types/index.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Coordinates peer takeover operations
 */
export class PeerTakeoverCoordinator {
  constructor(
    private agentPool: AgentPool,
    private messageBus: MessageBus
  ) {}

  /**
   * Initiate task takeover by a peer agent
   */
  async initiateTakeover(failedAgentId: string, taskId: string): Promise<boolean> {
    const failedAgent = this.agentPool.getAgent(failedAgentId)

    if (!failedAgent) {
      console.error(`[PeerTakeover] Agent ${failedAgentId} not found`)
      return false
    }

    // Find available peers in the same layer
    const peers = this.agentPool
      .getAgentsByLayer(failedAgent.getLayer() as 'top' | 'mid' | 'bottom')
      .filter((p) => p.getId() !== failedAgentId && p.getStatus() === AgentStatus.IDLE)

    if (peers.length === 0) {
      console.log('[PeerTakeover] No available peers')
      return false
    }

    // Request help from first available peer
    const peer = peers[0]
    if (!peer) {
      return false
    }

    console.log(`[PeerTakeover] Requesting ${peer.getId()} to help ${failedAgentId}`)

    this.messageBus.sendMessage({
      id: uuidv4(),
      from: 'system',
      to: peer.getId(),
      type: MessageType.PEER_HELP_REQUEST,
      content: {
        helpType: 'take_over_task',
        failedAgentId,
        taskId,
        // Task details will be retrieved by peer from whiteboard/database
      },
      timestamp: Date.now(),
      taskId: 'system', // System-level message
    })

    // Wait for peer response (with timeout)
    const response = await this.waitForPeerResponse(peer.getId(), 10000)

    if (response?.accepted) {
      console.log(`[PeerTakeover] ${peer.getId()} accepted takeover`)
      return true
    } else {
      console.log(`[PeerTakeover] ${peer.getId()} declined or timed out`)
      return false
    }
  }

  /**
   * Wait for peer response with timeout
   */
  private async waitForPeerResponse(
    peerId: string,
    timeoutMs: number
  ): Promise<{ accepted: boolean } | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), timeoutMs)

      // Listen for response message
      const checkResponse = () => {
        const messages = this.messageBus.getMessages('system')
        const response = messages.find(
          (m) => m.from === peerId && m.type === MessageType.PEER_HELP_RESPONSE
        )

        if (response) {
          clearTimeout(timeout)
          resolve(response.content as { accepted: boolean })
        } else {
          setTimeout(checkResponse, 100)
        }
      }

      checkResponse()
    })
  }
}
