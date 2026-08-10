import { useWallet } from '@matchain/matchid-sdk-react/hooks';
import { useMemo } from 'react';
import { createPublicClient, http } from 'viem';
import { blockchain } from './utils';

const useClient = () => {
  const { createWalletClient } = useWallet()

  const walletClient = useMemo(() => {
    return createWalletClient({
      chain: blockchain.chain,
      transport: http(),
    })
  }, [createWalletClient])

  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: blockchain.chain,
      transport: http(),
    })
  }, [])

  return { walletClient, publicClient }
}

export default useClient;