import { useState, useEffect, useMemo, useCallback } from 'react';
import useClient from './useClient';

const useReadContract = (props) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetch, setIsRefetch] = useState(false);
  const { publicClient } = useClient();
  
  const memoizedProps = useMemo(
    () => ({
      address: props.address,
      abi: props.abi,
      functionName: props.functionName,
      args: props.args,
    }),
    [props.address, props.abi, props.functionName, props.args]
  );

  useEffect(() => {
    readContract(
      memoizedProps.address,
      memoizedProps.abi,
      memoizedProps.functionName,
      memoizedProps.args
    );
  }, []);

  useEffect(() => {
    if (isRefetch) {
      readContract(
        memoizedProps.address,
        memoizedProps.abi,
        memoizedProps.functionName,
        memoizedProps.args
      );
    }
  }, [isRefetch]);

  const readContract = useCallback(
    async (address, abi, functionName, args) => {
      try {
        setIsLoading(true);
        setIsError(false);
        const result = await publicClient?.readContract({
          address,
          abi,
          functionName,
          args,
        });
        setData(result);
        return result;
      } catch (error) {
        console.error(error);
        setError(error.message);
        setIsError(true);
      } finally {
        setIsLoading(false);
        setIsRefetch(false);
      }
    },
    [publicClient]
  );

  const refetch = useCallback(() => {
    setIsRefetch(true);
  }, []);

  return { refetch, isLoading, isError, error, data };
};

export default useReadContract;