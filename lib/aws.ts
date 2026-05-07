import { Amplify } from 'aws-amplify'
import { fetchAuthSession } from 'aws-amplify/auth'

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

  Amplify.configure({
    Auth: {
      Cognito: cognitoConfig,
    },
    Storage: {
      S3: {
        bucket: config.public.s3Bucket,
        region: config.public.awsRegion,
      },
    },
  })
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
