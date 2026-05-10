export interface FieldError {
  fieldName: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  isValid: boolean
  errors: FieldError[]
}

export type ValidatorFn<T> = (data: Partial<T>, allNodes?: any[]) => ValidationResult
