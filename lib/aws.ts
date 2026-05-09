import { Amplify } from 'aws-amplify'
import { fetchAuthSession } from 'aws-amplify/auth'

// Must match the pattern used by @aws-amplify/storage to validate bucket names.
const S3_BUCKET_DNS_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/
const S3_BUCKET_IP_PATTERN = /(\d+\.){3}\d+/
const S3_BUCKET_DOTS_PATTERN = /\.\./

function isValidS3BucketName(name: string): boolean {
  return (
    S3_BUCKET_DNS_PATTERN.test(name)
    && !S3_BUCKET_IP_PATTERN.test(name)
    && !S3_BUCKET_DOTS_PATTERN.test(name)
  )
}

let s3StorageConfigured = false

export function isS3Configured(): boolean {
  return s3StorageConfigured
}

function getMissingAwsCredentialsMessage() {
  return 'Browser AWS credentials are unavailable. Configure NUXT_PUBLIC_COGNITO_IDENTITY_POOL_ID and sign in before using AWS-backed features.'
}

export function configureAWS() {
  const config = useRuntimeConfig()
  const cognitoConfig = config.public.cognitoIdentityPoolId
    ? {
        userPoolId: config.public.cognitoUserPoolId,
        userPoolClientId: config.public.cognitoClientId,
        identityPoolId: config.public.cognitoIdentityPoolId,
      }
    : {
        userPoolId: config.public.cognitoUserPoolId,
        userPoolClientId: config.public.cognitoClientId,
      }

  const bucketName = config.public.s3Bucket
  s3StorageConfigured = isValidS3BucketName(bucketName)

  const amplifyConfig: Parameters<typeof Amplify.configure>[0] = {
    Auth: {
      Cognito: cognitoConfig,
    },
  }

  if (s3StorageConfigured) {
    amplifyConfig.Storage = {
      S3: {
        bucket: bucketName,
        region: config.public.awsRegion,
      },
    }
  }
  else if (bucketName) {
    console.warn(
      `[S3] The configured bucket name "${bucketName}" is not DNS-compatible. `
      + 'S3 storage features will be disabled. '
      + 'Ensure NUXT_PUBLIC_S3_BUCKET contains a valid bucket name '
      + '(lowercase letters, numbers, and hyphens only, 3–63 characters).'
    )
  }

  Amplify.configure(amplifyConfig)
}

export async function getBrowserAwsCredentials() {
  const config = useRuntimeConfig()

  if (!config.public.cognitoIdentityPoolId) {
    throw new Error(getMissingAwsCredentialsMessage())
  }

  const session = await fetchAuthSession()

  if (!session.credentials) {
    throw new Error(getMissingAwsCredentialsMessage())
  }

  return session.credentials
}
