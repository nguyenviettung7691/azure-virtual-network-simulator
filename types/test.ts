export type TestType = 'connection' | 'loadbalance' | 'security' | 'dns'

export type TestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'warning'

export interface TestCondition {
  sourceId: string
  targetId: string
  protocol?: string
  port?: number
  expectedResult?: 'allow' | 'deny'
}

export interface TestResult {
  status: TestStatus
  message: string
  details?: string[]
  latencyMs?: number
  hopCount?: number
  path?: string[]
  timestamp: string
}

export interface NetworkTest {
  id: string
  name: string
  type: TestType
  description: string
  condition: TestCondition
  status: TestStatus
  result?: TestResult
  createdAt: string
  runAt?: string
}
