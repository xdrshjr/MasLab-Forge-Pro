/**
 * Example: Basic usage of the Multi-Agent Governance Framework
 *
 * This example demonstrates how to use the framework programmatically
 * to create a simple multi-agent task.
 */

import { VERSION, FRAMEWORK_INFO, AgentStatus, MessageType } from '@magf/core'

// Display framework information
console.log('='.repeat(60))
console.log(`${FRAMEWORK_INFO.name} v${VERSION}`)
console.log(FRAMEWORK_INFO.description)
console.log('='.repeat(60))

// Example: Working with agent statuses
console.log('\n📊 Agent Status Examples:')
console.log(`- Initializing: ${AgentStatus.INITIALIZING}`)
console.log(`- Working: ${AgentStatus.WORKING}`)
console.log(`- Idle: ${AgentStatus.IDLE}`)

// Example: Working with message types
console.log('\n📨 Message Type Examples:')
console.log(`- Task Assignment: ${MessageType.TASK_ASSIGN}`)
console.log(`- Progress Report: ${MessageType.PROGRESS_REPORT}`)
console.log(`- Signature Request: ${MessageType.SIGNATURE_REQUEST}`)

console.log('\n✅ Example completed successfully!')
console.log('Note: Full agent team functionality will be available in future releases.\n')
