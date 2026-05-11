import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import bs58 from 'bs58'

export function useWalletFlow(
  submitFn: (data: { signature: string, publicKey: string, message: string }) => Promise<any>,
  userId?: string
) {
  const wallet = useWallet()
  const [status, setStatus] = useState<'idle' | 'signing' | 'submitting' | 'done' | 'error'>('idle')

  const trigger = async () => {
  try {
    setStatus('signing')

    // 1. Ensure connected FIRST
    
    if (!wallet.publicKey || !wallet.signMessage) {
      throw new Error("Wallet does not support signing")
    }

    const timestamp = Date.now()
    const messageToSign =
      `Link Solana wallet to 16Signals\nUser: ${userId || 'unknown'}\nTimestamp: ${timestamp}`

    const sig = await wallet.signMessage(
      new TextEncoder().encode(messageToSign)
    )

    setStatus('submitting')

    await submitFn({
      signature: bs58.encode(sig),
      publicKey: wallet.publicKey.toBase58(),
      message: messageToSign
    })

    setStatus('done')
  } catch (e) {
    console.error(e)
    setStatus('error')
    setTimeout(() => setStatus('idle'), 3000)
  }
}

  return { trigger, status }
}
