/**
 * 钱包连接组件
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWallet } from '@/hooks/useWallet';
import { WalletType } from '@/types/wallet';
import { ImportWallet } from './ImportWallet';
import { MetaMaskImport } from './MetaMaskImport';
import { ViewCredentials } from './ViewCredentials';
import { PasswordDialog } from './PasswordDialog';
import { walletManager } from '@/lib/wallet/manager';
import { deriveAllNetworkAddresses } from '@/lib/utils/addressDerivation';

const WALLET_NAMES: Record<WalletType, string> = {
  [WalletType.ONEKEY]: 'OneKey',
  [WalletType.LEDGER]: 'Ledger',
  [WalletType.TREZOR]: 'Trezor',
  [WalletType.MNEMONIC]: '助记词',
  [WalletType.PRIVATE_KEY]: '私钥',
};

interface WalletConnectorProps {
  walletId?: string | null; // 选中的钱包 ID，如果提供则显示该钱包的详细信息
}

export function WalletConnector({ walletId }: WalletConnectorProps = {}) {
  const {
    connection,
    availableWallets,
    isConnecting,
    error,
    connect,
    disconnect,
    getPublicKey,
    importWallet,
    restoreWallet,
  } = useWallet();

  const [selectedWallet, setSelectedWallet] = useState<WalletType | ''>('');
  const [publicKey, setPublicKey] = useState<string>('');
  const [loadingPublicKey, setLoadingPublicKey] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMetaMaskImport, setShowMetaMaskImport] = useState(false);
  const [showViewCredentials, setShowViewCredentials] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [hasStoredWallet, setHasStoredWallet] = useState(false);
  const [encryptedData, setEncryptedData] = useState<string | null>(null);
  const [savingWallet, setSavingWallet] = useState(false);
  const [allNetworkAddresses, setAllNetworkAddresses] = useState<Array<{ network: string; chainId: string; address: string; networkName: string }>>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [selectedWalletInfo, setSelectedWalletInfo] = useState<{ address?: string; publicKey?: string; walletType?: string } | null>(null);
  const [loadingWalletInfo, setLoadingWalletInfo] = useState(false);
  const [multipleAccounts, setMultipleAccounts] = useState<Array<{ address: string; publicKey?: string; networkAddresses: Array<{ network: string; chainId: string; address: string; networkName: string }> }>>([]);
  const [loadingMultipleAccounts, setLoadingMultipleAccounts] = useState(false);

  const handleConnect = async () => {
    if (!selectedWallet) return;

    try {
      await connect(selectedWallet as WalletType);
      setSelectedWallet('');
      
      // 如果是硬件钱包，自动保存并派生所有网络地址
      const connection = walletManager.getCurrentConnection();
      if (connection && (
        connection.type === WalletType.ONEKEY ||
        connection.type === WalletType.LEDGER ||
        connection.type === WalletType.TREZOR
      )) {
        try {
          // 获取多个账户
          setLoadingMultipleAccounts(true);
          try {
            console.log('开始获取多个账户...');
            const accounts = await walletManager.getMultipleAccounts(10); // 获取最多10个账户
            console.log('获取到的账户数量:', accounts.length, accounts);
            
            // 为每个账户派生所有网络地址
            const accountsWithAddresses = await Promise.all(
              accounts.map(async (acc, index) => {
                console.log(`处理账户 ${index + 1}:`, acc.address);
                let networkAddresses: Array<{ network: string; chainId: string; address: string; networkName: string }> = [];
                
                if (acc.publicKey) {
                  try {
                    networkAddresses = await deriveAllNetworkAddresses(
                      acc.publicKey,
                      acc.address // TRON 地址
                    );
                  } catch (err: any) {
                    console.warn(`派生账户 ${acc.address} 的网络地址失败:`, err.message);
                    // 至少添加 TRON 地址
                    networkAddresses = [{
                      network: 'TRON',
                      chainId: 'tron:728126428',
                      address: acc.address || '',
                      networkName: 'TRON Mainnet',
                    }];
                  }
                } else {
                  // 如果没有公钥，至少添加 TRON 地址
                  networkAddresses = [{
                    network: 'TRON',
                    chainId: 'tron:728126428',
                    address: acc.address || '',
                    networkName: 'TRON Mainnet',
                  }];
                }
                
                return {
                  address: acc.address || '',
                  publicKey: acc.publicKey,
                  networkAddresses,
                };
              })
            );
            
            setMultipleAccounts(accountsWithAddresses);
            
            // 同时设置第一个账户的网络地址（用于向后兼容）
            const firstAccount = accountsWithAddresses[0];
            if (firstAccount && firstAccount.networkAddresses && firstAccount.networkAddresses.length > 0) {
              setAllNetworkAddresses(firstAccount.networkAddresses);
            }

            // 保存所有账户到服务器
            console.log(`准备保存 ${accounts.length} 个账户...`);
            try {
              await walletManager.saveMultipleAccountsToStorage(accounts);
              console.log(`成功保存 ${accounts.length} 个账户`);
            } catch (err: any) {
              console.error('保存多个账户失败:', err);
              // 如果保存多个账户失败，尝试保存当前账户（向后兼容）
              try {
                await walletManager.saveWalletToStorage(undefined);
                console.log('已保存当前账户（向后兼容）');
              } catch (err2: any) {
                console.error('保存当前账户也失败:', err2);
              }
            }
          } catch (err: any) {
            console.warn('获取多个账户失败:', err.message);
            // 如果获取多个账户失败，至少派生当前账户的网络地址
            if (connection.publicKey) {
              setLoadingAddresses(true);
              try {
                const addresses = await deriveAllNetworkAddresses(
                  connection.publicKey,
                  connection.address // TRON 地址
                );
                setAllNetworkAddresses(addresses);
              } catch (err2: any) {
                console.warn('派生网络地址失败:', err2.message);
              } finally {
                setLoadingAddresses(false);
              }
            }
            // 如果获取多个账户失败，至少保存当前账户
            try {
              await walletManager.saveWalletToStorage(undefined);
              console.log('已保存当前账户（获取多个账户失败后的回退）');
            } catch (err3: any) {
              console.error('保存当前账户失败:', err3);
            }
          } finally {
            setLoadingMultipleAccounts(false);
          }
          
          // 等待一小段时间确保后端保存完成
          await new Promise(resolve => setTimeout(resolve, 500));
          // 触发钱包变化事件，刷新列表
          window.dispatchEvent(new CustomEvent('walletChanged'));
        } catch (err: any) {
          console.warn('自动保存硬件钱包失败:', err.message);
          // 不阻止连接流程，只记录警告
        }
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setPublicKey('');
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
    }
  };

  const handleGetPublicKey = async () => {
    if (!connection) return;

    setLoadingPublicKey(true);
    try {
      const key = await getPublicKey();
      setPublicKey(key);
    } catch (err) {
      console.error('Failed to get public key:', err);
    } finally {
      setLoadingPublicKey(false);
    }
  };

  // 检查是否有保存的软件钱包（硬件钱包不需要恢复）
  useEffect(() => {
    const checkStoredWallet = async () => {
      // 只检查软件钱包（助记词/私钥），硬件钱包不需要恢复功能
      // 如果当前连接的是硬件钱包，不显示恢复按钮
      if (connection && (
        connection.type === WalletType.ONEKEY ||
        connection.type === WalletType.LEDGER ||
        connection.type === WalletType.TREZOR
      )) {
        setHasStoredWallet(false);
        return;
      }
      
      const hasStored = await walletManager.hasStoredWallet();
      setHasStoredWallet(hasStored);
    };
    checkStoredWallet();
  }, [connection]);

  // 当 walletId 变化时，加载钱包信息并派生所有网络地址
  useEffect(() => {
    const loadWalletInfo = async () => {
      if (!walletId) {
        setSelectedWalletInfo(null);
        setAllNetworkAddresses([]);
        return;
      }

      try {
        setLoadingWalletInfo(true);
        const { getPublicKeyFromServer } = await import('@/lib/api/wallet');
        const result = await getPublicKeyFromServer(walletId);
        
        if (result.success && result.publicKey) {
          setSelectedWalletInfo({
            address: result.address,
            publicKey: result.publicKey,
            walletType: result.walletType || 'software', // 使用后端返回的钱包类型，默认为 software
          });

          // 派生所有网络地址
          if (result.publicKey) {
            setLoadingAddresses(true);
            try {
              const addresses = await deriveAllNetworkAddresses(
                result.publicKey,
                result.address // TRON 地址
              );
              setAllNetworkAddresses(addresses);
            } catch (err: any) {
              console.warn('派生网络地址失败:', err.message);
            } finally {
              setLoadingAddresses(false);
            }
          }
        } else {
          setSelectedWalletInfo(null);
        }
      } catch (err: any) {
        console.error('Failed to load wallet info:', err);
        setSelectedWalletInfo(null);
      } finally {
        setLoadingWalletInfo(false);
      }
    };

    loadWalletInfo();
  }, [walletId]);

  const handleImport = async (
    type: WalletType,
    credentials: { mnemonic?: string; privateKey?: string },
    password: string
  ) => {
    try {
      await importWallet(type, credentials, password);
      setShowImport(false);
      // 获取加密数据以便后续查看
      const stored = await walletManager.getCurrentConnection();
      if (stored) {
        const provider = walletManager.getProvider(stored.type);
        if (provider && (provider as any).saveEncrypted) {
          const encrypted = await (provider as any).saveEncrypted(password);
          setEncryptedData(encrypted);
        }
      }
    } catch (err) {
      console.error('Failed to import wallet:', err);
      throw err;
    }
  };

  const handleMetaMaskImport = async (
    mnemonic: string,
    password: string
  ) => {
    try {
      // 使用助记词导入
      await importWallet(WalletType.MNEMONIC, { mnemonic }, password);
      setShowMetaMaskImport(false);
      // 获取加密数据以便后续查看
      const { getEncryptedWallet } = await import('@/lib/storage/walletStorage');
      const stored = getEncryptedWallet();
      if (stored) {
        setEncryptedData(stored.encryptedData);
      }
    } catch (err) {
      console.error('Failed to import MetaMask wallet:', err);
      throw err;
    }
  };

  const handleRestore = async (password: string) => {
    try {
      await restoreWallet(password);
      setShowRestore(false);
    } catch (err) {
      console.error('Failed to restore wallet:', err);
      throw err;
    }
  };

  // 处理钱包选择 - 如果是助记词或私钥，显示导入界面
  const handleWalletSelect = (type: WalletType) => {
    if (type === WalletType.MNEMONIC || type === WalletType.PRIVATE_KEY) {
      setShowImport(true);
    } else {
      setSelectedWallet(type);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>钱包连接</CardTitle>
        <CardDescription>
          连接硬件钱包以获取支付地址（公钥）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingWalletInfo ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">正在加载钱包信息...</p>
          </div>
        ) : selectedWalletInfo && walletId ? (
          // 显示已保存的钱包信息
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">钱包类型: </span>
                  <span className="text-sm">
                    {selectedWalletInfo.walletType === 'hardware' ? '硬件钱包' : 
                     selectedWalletInfo.walletType === 'software' ? '软件钱包' :
                     selectedWalletInfo.walletType === 'mnemonic' ? '助记词钱包' : 
                     selectedWalletInfo.walletType === 'private_key' ? '私钥钱包' : 
                     '未知类型'}
                  </span>
                </div>
                {selectedWalletInfo.publicKey && (
                  <div>
                    <span className="text-sm font-medium">公钥: </span>
                    <span className="text-sm font-mono break-all">{selectedWalletInfo.publicKey}</span>
                  </div>
                )}
                
                {/* 显示所有网络地址 */}
                {loadingAddresses ? (
                  <div className="text-sm text-muted-foreground">正在计算所有网络地址...</div>
                ) : allNetworkAddresses.length > 0 ? (
                  <div className="space-y-2 mt-4">
                    <div className="text-sm font-medium">所有网络地址:</div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {allNetworkAddresses.map((netAddr, index) => (
                        <div key={index} className="p-2 bg-background rounded border text-xs">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {netAddr.networkName}
                          </div>
                          <div className="text-muted-foreground mt-1">
                            <span className="font-mono break-all">{netAddr.address}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedWalletInfo.publicKey ? (
                  <div className="text-xs text-muted-foreground">
                    <p>正在计算所有网络地址...</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : !connection ? (
          <>
            {hasStoredWallet && (
              <Button
                onClick={() => setShowRestore(true)}
                variant="outline"
                className="w-full"
              >
                恢复已保存的钱包
              </Button>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">选择钱包类型</label>
              <Select
                value={selectedWallet || undefined}
                onValueChange={(value) => handleWalletSelect(value as WalletType)}
                disabled={isConnecting || availableWallets.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择钱包类型" />
                </SelectTrigger>
                {availableWallets.length > 0 && (
                  <SelectContent>
                    {availableWallets.map((type) => (
                      <SelectItem key={type} value={type}>
                        {WALLET_NAMES[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                )}
              </Select>
            </div>

            {availableWallets.length === 0 && (
              <p className="text-sm text-muted-foreground">
                请确保已安装并启用硬件钱包扩展或连接硬件设备
              </p>
            )}

            <Button
              onClick={handleConnect}
              disabled={!selectedWallet || isConnecting || availableWallets.length === 0}
              className="w-full"
            >
              {isConnecting ? '连接中...' : '连接钱包'}
            </Button>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">
                  {error.message}
                </p>
              </div>
            )}
          </>
        ) : selectedWalletInfo && walletId ? (
          // 显示已保存的钱包信息
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">钱包类型: </span>
                  <span className="text-sm">
                    {selectedWalletInfo.walletType === 'hardware' ? '硬件钱包' : 
                     selectedWalletInfo.walletType === 'software' ? '软件钱包' :
                     selectedWalletInfo.walletType === 'mnemonic' ? '助记词钱包' : 
                     selectedWalletInfo.walletType === 'private_key' ? '私钥钱包' : 
                     '未知类型'}
                  </span>
                </div>
                {selectedWalletInfo.publicKey && (
                  <div>
                    <span className="text-sm font-medium">公钥: </span>
                    <span className="text-sm font-mono break-all">{selectedWalletInfo.publicKey}</span>
                  </div>
                )}
                
                {/* 显示所有网络地址 */}
                {loadingAddresses ? (
                  <div className="text-sm text-muted-foreground">正在计算所有网络地址...</div>
                ) : allNetworkAddresses.length > 0 ? (
                  <div className="space-y-2 mt-4">
                    <div className="text-sm font-medium">所有网络地址:</div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {allNetworkAddresses.map((netAddr, index) => (
                        <div key={index} className="p-2 bg-background rounded border text-xs">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {netAddr.networkName}
                          </div>
                          <div className="text-muted-foreground mt-1">
                            <span className="font-mono break-all">{netAddr.address}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : selectedWalletInfo.publicKey ? (
                  <div className="text-xs text-muted-foreground">
                    <p>正在计算所有网络地址...</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          // 显示当前连接的钱包信息
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">钱包类型: </span>
                  <span className="text-sm">{WALLET_NAMES[connection.type]}</span>
                </div>
                {connection.publicKey && (
                  <div>
                    <span className="text-sm font-medium">公钥: </span>
                    <span className="text-sm font-mono break-all">{connection.publicKey}</span>
                  </div>
                )}
                
                {/* 显示多个账户 */}
                {loadingMultipleAccounts ? (
                  <div className="text-sm text-muted-foreground mt-4">正在获取多个账户...</div>
                ) : multipleAccounts.length > 0 ? (
                  <div className="space-y-4 mt-4">
                    <div className="text-sm font-medium">
                      所有账户 ({multipleAccounts.length} 个)
                      {multipleAccounts.length === 1 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (提示: 如果硬件钱包有多个账户，请检查控制台日志)
                        </span>
                      )}
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {multipleAccounts.map((account, accountIndex) => (
                        <div key={accountIndex} className="p-3 bg-background rounded border">
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100 mb-2">
                            账户 #{accountIndex + 1}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            <span className="font-mono break-all">TRON: {account.address}</span>
                          </div>
                          {account.networkAddresses.length > 0 && (
                            <div className="space-y-1 mt-2">
                              {account.networkAddresses.map((netAddr, netIndex) => (
                                <div key={netIndex} className="text-xs p-1.5 bg-muted rounded">
                                  <div className="font-medium text-slate-700 dark:text-slate-300">
                                    {netAddr.networkName}
                                  </div>
                                  <div className="text-muted-foreground mt-0.5">
                                    <span className="font-mono break-all text-[10px]">{netAddr.address}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* 显示单个账户的所有网络地址 */
                  loadingAddresses ? (
                    <div className="text-sm text-muted-foreground mt-4">正在计算所有网络地址...</div>
                  ) : allNetworkAddresses.length > 0 ? (
                    <div className="space-y-2 mt-4">
                      <div className="text-sm font-medium">所有网络地址:</div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {allNetworkAddresses.map((netAddr, index) => (
                          <div key={index} className="p-2 bg-background rounded border text-xs">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {netAddr.networkName}
                            </div>
                            <div className="text-muted-foreground mt-1">
                              <span className="font-mono break-all">{netAddr.address}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : connection.publicKey ? (
                    <div className="text-xs text-muted-foreground mt-4">
                      <p>正在计算所有网络地址...</p>
                    </div>
                  ) : null
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleGetPublicKey}
                disabled={loadingPublicKey}
                variant="outline"
                className="w-full"
              >
                {loadingPublicKey ? '获取中...' : '获取公钥（支付地址）'}
              </Button>

              {/* 保存钱包按钮 */}
              <Button
                onClick={async () => {
                  try {
                    setSavingWallet(true);
                    // 硬件钱包不需要密码
                    const isHardwareWallet = 
                      connection.type === WalletType.ONEKEY ||
                      connection.type === WalletType.LEDGER ||
                      connection.type === WalletType.TREZOR;
                    
                    if (isHardwareWallet) {
                      await walletManager.saveWalletToStorage(undefined);
                      // 等待一小段时间确保后端保存完成
                      await new Promise(resolve => setTimeout(resolve, 500));
                      // 触发钱包变化事件，刷新列表
                      window.dispatchEvent(new CustomEvent('walletChanged'));
                      alert('钱包已保存');
                    } else {
                      // 软件钱包需要密码，这里暂时不处理，用户应该先导入
                      alert('软件钱包请使用导入功能保存');
                      return;
                    }
                  } catch (err: any) {
                    console.error('Failed to save wallet:', err);
                    alert(`保存失败: ${err.message}`);
                  } finally {
                    setSavingWallet(false);
                  }
                }}
                variant="outline"
                className="w-full"
                disabled={savingWallet}
              >
                {savingWallet ? '保存中...' : '保存钱包'}
              </Button>

              {/* 查看私钥/助记词（仅软件钱包） */}
              {(connection.type === WalletType.PRIVATE_KEY || 
                connection.type === WalletType.MNEMONIC) && (
                <Button
                  onClick={async () => {
                    // 使用地址作为 walletId（与保存时一致）
                    const walletId = connection.address.slice(0, 16);
                    setEncryptedData(walletId); // 临时存储 walletId
                    setShowViewCredentials(true);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  查看私钥/助记词（需要密码）
                </Button>
              )}

              {/* 查看公钥（硬件钱包） */}
              {(connection.type === WalletType.ONEKEY ||
                connection.type === WalletType.LEDGER ||
                connection.type === WalletType.TREZOR) && (
                <Button
                  onClick={async () => {
                    // 硬件钱包：尝试从服务器查找 walletId，如果找不到则使用地址生成
                    try {
                      const { listWallets, getPublicKeyFromServer } = await import('@/lib/api/wallet');
                      const listResult = await listWallets();
                      if (listResult.success && listResult.walletIds) {
                        // 查找匹配的钱包 ID
                        for (const id of listResult.walletIds) {
                          const pubKeyResult = await getPublicKeyFromServer(id);
                          if (pubKeyResult.success && pubKeyResult.address === connection.address) {
                            setEncryptedData(id);
                            setShowViewCredentials(true);
                            return;
                          }
                        }
                      }
                    } catch (err) {
                      console.warn('Failed to find wallet ID, using address:', err);
                    }
                    // 如果找不到，使用地址生成 walletId（仅用于显示，不会保存）
                    const walletId = `${connection.address.slice(0, 12)}_temp`;
                    setEncryptedData(walletId);
                    setShowViewCredentials(true);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  查看公钥
                </Button>
              )}

              {publicKey && (
                <div className="p-4 bg-muted rounded-md">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">支付地址（公钥）:</div>
                    <div className="text-sm font-mono break-all bg-background p-2 rounded border">
                      {publicKey}
                    </div>
                    <Button
                      onClick={() => navigator.clipboard.writeText(publicKey)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      复制公钥
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={handleDisconnect}
              variant="destructive"
              className="w-full"
            >
              断开连接
            </Button>
          </div>
        )}
      </CardContent>

      {showImport && (
        <div className="mt-4">
          <ImportWallet
            onImport={handleImport}
            onCancel={() => setShowImport(false)}
          />
        </div>
      )}

      {showRestore && (
        <PasswordDialog
          mode="verify"
          onSubmit={handleRestore}
          onCancel={() => setShowRestore(false)}
          title="恢复钱包"
          description="请输入密码以解锁您保存的钱包。"
        />
      )}

      {showMetaMaskImport && (
        <div className="mt-4">
          <MetaMaskImport
            onImport={handleMetaMaskImport}
            onCancel={() => setShowMetaMaskImport(false)}
          />
        </div>
      )}

      {showViewCredentials && encryptedData && (
        <ViewCredentials
          walletId={encryptedData}
          onClose={() => {
            setShowViewCredentials(false);
            setEncryptedData(null);
          }}
        />
      )}
    </Card>
  );
}
