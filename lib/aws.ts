import { Amplify } from 'aws-amplify'
import { fetchAuthSession } from 'aws-amplify/auth'

// Must match the pattern used by @aws-amplify/storage to validate bucket names.
const S3_BUCKET_DNS_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/
const S3_BUCKET_IP_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/
const S3_BUCKET_DOTS_PATTERN = /\.\./
const S3_BUCKET_RESERVED_PREFIXES = ['xn--', 'sthree-', 'amzn-s3-demo-']
const S3_BUCKET_RESERVED_SUFFIXES = ['-s3alias', '--ol-s3', '.mrap', '--x-s3', '--table-s3']
const S3_ACCOUNT_REGIONAL_NAMESPACE_PATTERN = /-\d{12}-[a-z0-9-]+-an$/

function isValidS3BucketName(name: string): boolean {
  const normalizedName = name.trim()

  if (!normalizedName) {
    return false
  }

  if (S3_BUCKET_RESERVED_PREFIXES.some(prefix => normalizedName.startsWith(prefix))) {
    return false
  }

  if (S3_BUCKET_RESERVED_SUFFIXES.some(suffix => normalizedName.endsWith(suffix))) {
    return false
  }

  if (normalizedName.endsWith('-an') && !S3_ACCOUNT_REGIONAL_NAMESPACE_PATTERN.test(normalizedName)) {
    return false
  }

  return (
    S3_BUCKET_DNS_PATTERN.test(normalizedName)
    && !S3_BUCKET_IP_PATTERN.test(normalizedName)
    && !S3_BUCKET_DOTS_PATTERN.test(normalizedName)
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

  const bucketName = config.public.s3Bucket.trim()
  s3StorageConfigured = isValidS3BucketName(bucketName)

  const amplifyConfig: Record<string, any> = {
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
      `[S3] The configured bucket name "${bucketName}" is not valid for general purpose S3 buckets. `
      + 'S3 storage features will be disabled. '
      + 'Ensure NUXT_PUBLIC_S3_BUCKET contains a valid bucket name '
      + '(3-63 chars, lowercase letters/numbers/periods/hyphens, not IP-like, no reserved prefixes/suffixes; '
      + 'suffix "-an" is only valid for account regional namespace bucket names).'
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
