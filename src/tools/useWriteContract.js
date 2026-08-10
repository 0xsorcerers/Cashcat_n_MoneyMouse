import { useCallback, useRef, useState } from 'react';
import useClient from './useClient';

const useWriteContract = () => {
  const [error, setError] = useState(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const hash = useRef(null);
  const { walletClient, publicClient } = useClient();

  const writeContract = useCallback(
    async (props) => {
      try {
        setIsLoading(true);
        setIsError(false);

        hash.current = await walletClient?.writeContract({
          ...props,
          address: props.address,
        });

        if (!hash.current) {
          throw new Error('Transaction hash is null');
        }

        const receipt = await publicClient.waitForTransactionReceipt({
          confirmations: 2,
          hash: hash.current,
        });

        if (receipt.status === 'success') {
          console.log('Transaction success');
        }

        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted');
        }

        return hash.current;
      } catch (error) {
        console.log('writeContract error', error?.shortMessage);
        console.log('writeContract error', error);

        setError(error?.shortMessage || error);
        setIsError(true);

        throw new Error(error?.shortMessage || error);
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient]
  );

  return {
    writeContract,
    isLoading,
    isError,
    error,
    hash: hash.current,
  };
};

export default useWriteContract;