import { Amplify } from 'aws-amplify'

export function configureAWS() {
  const config = useRuntimeConfig()

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.public.cognitoUserPoolId,
        userPoolClientId: config.public.cognitoClientId,
      },
    },
    Storage: {
      S3: {
        bucket: config.public.s3Bucket,
        region: config.public.awsRegion,
      },
    },
  })
}
