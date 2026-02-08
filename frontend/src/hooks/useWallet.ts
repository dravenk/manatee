/**
 * React Hook for wallet management
 */

import { useState, useEffect, useCallback } from 'react';
import { WalletType, WalletConnection, WalletError } from '@/types/wallet';
import { walletManager } from '@/lib/wallet/manager';

export interface UseWalletReturn {
  // 状态
  connection: WalletConnection | null;
  availableWallets: WalletType[];
  isConnecting: boolean;
  error: WalletError | null;

  // 方法
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  getAddress: () => Promise<string>;
  getPublicKey: () => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  signTransaction: (transaction: any) => Promise<any>;
  refreshAvailableWallets: () => Promise<void>;
  importWallet: (type: WalletType, credentials: { mnemonic?: string; privateKey?: string }, password: string) => Promise<void>;
  restoreWallet: (password: string) => Promise<void>;
}

export function useWallet(): UseWalletReturn {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [availableWallets, setAvailableWallets] = useState<WalletType[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<WalletError | null>(null);

  // 初始化：检查可用钱包和当前连接
  useEffect(() => {
    const init = async () => {
      try {
        const available = await walletManager.getAvailableWallets();
        setAvailableWallets(available);

        const current = walletManager.getCurrentConnection();
        if (current) {
          setConnection(current);
        }
      } catch (err) {
        console.error('Failed to initialize wallet:', err);
      }
    };

    init();
  }, []);

  // 连接钱包
  const connect = useCallback(async (type: WalletType) => {
    setIsConnecting(true);
    setError(null);

    try {
      const newConnection = await walletManager.connect(type);
      setConnection(newConnection);
    } catch (err: any) {
      setError(err as WalletError);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // 导入钱包
  const importWallet = useCallback(async (
    type: WalletType,
    credentials: { mnemonic?: string; privateKey?: string },
    password: string
  ) => {
    setIsConnecting(true);
    setError(null);

    try {
      // 连接钱包
      const newConnection = await walletManager.connect(type, credentials);
      setConnection(newConnection);

      // 保存到本地存储
      await walletManager.saveWalletToStorage(password);
    } catch (err: any) {
      setError(err as WalletError);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // 恢复钱包
  const restoreWallet = useCallback(async (password: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      const newConnection = await walletManager.restoreWalletFromStorage(password);
      setConnection(newConnection);
    } catch (err: any) {
      setError(err as WalletError);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // 断开连接
  const disconnect = useCallback(async () => {
    try {
      await walletManager.disconnect();
      setConnection(null);
      setError(null);
    } catch (err: any) {
      setError(err as WalletError);
      throw err;
    }
  }, []);

  // 获取地址
  const getAddress = useCallback(async (): Promise<string> => {
    try {
      return await walletManager.getAddress();
    } catch (err: any) {
      setError(err as WalletError);
      throw err;
    }
  }, []);

  // 获取公钥
  const getPublicKey = useCallback(async (): Promise<string> => {
    try {
      return await walletManager.getPublicKey();
    } catch (err: any) {
      setError(err as WalletError);
      throw err;
    }
  }, []);

  // 签名消息
  const signMessage = useCallback(async (message: string): Promise<string> => {
    try {
      return await walletManager.signMessage(message);
    } catch (err: any) {
      setError(err as WalletError);
      throw err;
    }
  }, []);

  // 签名交易
  const signTransaction = useCallback(async (transaction: any): Promise<any> => {
    try {
      return await walletManager.signTransaction(transaction);
    } catch (err: any) {
      setError(err as WalletError);
      throw err;
    }
  }, []);

  // 刷新可用钱包列表
  const refreshAvailableWallets = useCallback(async () => {
    try {
      const available = await walletManager.getAvailableWallets();
      setAvailableWallets(available);
    } catch (err) {
      console.error('Failed to refresh available wallets:', err);
    }
  }, []);

  return {
    connection,
    availableWallets,
    isConnecting,
    error,
    connect,
    disconnect,
    getAddress,
    getPublicKey,
    signMessage,
    signTransaction,
    refreshAvailableWallets,
    importWallet,
    restoreWallet,
  };
}
