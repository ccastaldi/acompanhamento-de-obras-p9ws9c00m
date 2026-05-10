import pb from '@/lib/pocketbase/client'

export interface TokenResponse {
  token: string
  expiresIn: number
}

export const getOnedriveToken = async (): Promise<TokenResponse> => {
  return pb.send<TokenResponse>('/backend/v1/onedrive-get-token', {
    method: 'POST',
  })
}

export const refreshOnedriveToken = async (): Promise<TokenResponse> => {
  return pb.send<TokenResponse>('/backend/v1/onedrive-refresh-token', {
    method: 'POST',
  })
}
