/**
 * 钱包管理页面
 */

import { useState, useEffect, useRef } from 'react';
import { Plus, Wallet as WalletIcon, Loader2, Trash2, X, AlertCircle } from 'lucide-react';
import { WalletConnector } from '../WalletConnector';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '../ui/select';
import { listWallets, getPublicKeyFromServer, deleteWallet, getWalletAccounts, deriveAccount, getWallet } from '../../lib/api/wallet';
import type { GetPublicKeyRequest } from '../../lib/api/wallet';
import { ImportWallet } from '../ImportWallet';
import { MetaMaskImport } from '../MetaMaskImport';
import { AddWalletOptions } from '../AddWalletOptions';
import { PasswordDialog } from '../PasswordDialog';
import { useWallet } from '../../hooks/useWallet';
import { WalletType } from '../../types/wallet';
import { walletManager } from '../../lib/wallet/manager';
import { hasCachedKey, getCachedKey, cacheKey } from '../../lib/cache/walletCache';

interface WalletInfo {
  walletId: string;
  address?: string;
  publicKey?: string;
  alias?: string; // 钱包别名
  accounts?: Array<{
    walletId: string;
    address: string;
    publicKey?: string;
    accountIndex?: number;
    derivationPath?: string;
  }>; // 该钱包的所有账户
}

export function WalletPage() {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showMetaMaskImport, setShowMetaMaskImport] = useState(false);
  const [showAddWalletOptions, setShowAddWalletOptions] = useState(false);
  const [expandedWallets, setExpandedWallets] = useState<Set<string>>(new Set());
  const [derivingAccount, setDerivingAccount] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordDialogCallback, setPasswordDialogCallback] = useState<((password: string) => Promise<void>) | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const passwordCallbackRef = useRef<((password: string) => Promise<void>) | null>(null);
  const resolvePromiseRef = useRef<(() => void) | null>(null);
  const { importWallet } = useWallet();

  // 加载钱包列表
  const loadWallets = async () => {
    try {
      setLoading(true);
      const result = await listWallets();
      if (!result.success || !result.walletIds || result.walletIds.length === 0) {
        setWallets([]);
        return;
      }

      // 获取每个钱包的地址和公钥，以及所有账户
      const walletInfos: WalletInfo[] = [];
      const processedWalletIds = new Set<string>(); // 避免重复处理同一钱包的账户
      
      for (let i = 0; i < result.walletIds.length; i++) {
        const walletId = result.walletIds[i];
        if (!walletId || processedWalletIds.has(walletId)) continue;
        
        try {
          const publicKeyResult = await getPublicKeyFromServer(walletId);
          // 从本地存储读取别名，如果没有则使用默认编号
          const savedAlias = localStorage.getItem(`wallet_alias_${walletId}`);
          const alias = savedAlias || `wallet#${i + 1}`;
          
          // 获取该钱包的所有账户
          let accounts: Array<{
            walletId: string;
            address: string;
            publicKey?: string;
            accountIndex?: number;
            derivationPath?: string;
          }> = [];
          
          try {
            const accountsResult = await getWalletAccounts(walletId);
            if (accountsResult.success && accountsResult.accounts) {
              accounts = accountsResult.accounts;
              // 标记所有账户的 walletId 为已处理
              accounts.forEach(acc => processedWalletIds.add(acc.walletId));
            }
          } catch (err: any) {
            console.warn(`Failed to get accounts for wallet ${walletId}:`, err);
          }
          
          // 如果没有获取到账户列表，至少添加当前钱包
          if (accounts.length === 0) {
            if (publicKeyResult.success && publicKeyResult.address) {
              accounts = [{
                walletId,
                address: publicKeyResult.address,
                publicKey: publicKeyResult.publicKey || undefined,
                accountIndex: 0,
              }];
            }
          }
          
          if (publicKeyResult.success && publicKeyResult.address) {
            walletInfos.push({
              walletId,
              address: publicKeyResult.address,
              publicKey: publicKeyResult.publicKey || undefined,
              alias,
              accounts,
            });
          } else {
            walletInfos.push({ walletId, alias, accounts });
          }
          
          processedWalletIds.add(walletId);
        } catch (err: any) {
          console.warn(`Failed to get public key for wallet ${walletId}:`, err);
          const savedAlias = localStorage.getItem(`wallet_alias_${walletId}`);
          const alias = savedAlias || `wallet#${i + 1}`;
          walletInfos.push({ walletId, alias, accounts: [] });
        }
      }

      setWallets(walletInfos);

      // 从本地存储读取当前选中的钱包
      const savedWalletId = localStorage.getItem('selectedWalletId');
      if (savedWalletId && result.walletIds.includes(savedWalletId)) {
        setSelectedWalletId(savedWalletId);
      } else if (walletInfos.length > 0 && walletInfos[0]) {
        // 默认选择第一个钱包的第一个账户（account#0）
        const firstWallet = walletInfos[0];
        if (firstWallet.accounts && firstWallet.accounts.length > 0) {
          // 选择第一个账户（accountIndex = 0）
          const firstAccount = firstWallet.accounts.find(acc => (acc.accountIndex || 0) === 0) || firstWallet.accounts[0];
          if (firstAccount) {
            setSelectedWalletId(firstAccount.walletId);
          } else {
            setSelectedWalletId(firstWallet.walletId);
          }
        } else {
          setSelectedWalletId(firstWallet.walletId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load wallets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallets();

    // 监听钱包变化事件
    const handleWalletChanged = () => {
      loadWallets();
    };
    window.addEventListener('walletChanged', handleWalletChanged);
    return () => window.removeEventListener('walletChanged', handleWalletChanged);
  }, []);

  const getWalletDisplayName = (wallet: WalletInfo | undefined) => {
    if (!wallet) return '未知钱包';
    return wallet.alias || `wallet#${wallets.findIndex(w => w.walletId === wallet.walletId) + 1}`;
  };

  const handleWalletSelect = (walletId: string) => {
    setSelectedWalletId(walletId);
    localStorage.setItem('selectedWalletId', walletId);
    // 触发钱包切换事件
    window.dispatchEvent(new CustomEvent('walletChanged', { detail: { walletId } }));
  };

  // 获取当前选择的账户信息
  const getSelectedAccountInfo = () => {
    if (!selectedWalletId) return null;
    
    // 在所有钱包中查找选中的账户
    for (const wallet of wallets) {
      if (wallet.accounts) {
        const account = wallet.accounts.find(acc => acc.walletId === selectedWalletId);
        if (account) {
          return {
            wallet,
            account,
            accountIndex: account.accountIndex || 0,
          };
        }
      }
      // 如果没有找到账户，可能是直接选择了钱包（单个账户的情况）
      if (wallet.walletId === selectedWalletId) {
        return {
          wallet,
          account: {
            walletId: wallet.walletId,
            address: wallet.address,
            publicKey: wallet.publicKey,
            accountIndex: 0,
          },
          accountIndex: 0,
        };
      }
    }
    return null;
  };

  // 获取当前钱包的所有账户（用于下拉列表）
  const getCurrentWalletAccounts = () => {
    const accountInfo = getSelectedAccountInfo();
    if (!accountInfo) return [];
    return accountInfo.wallet.accounts || [];
  };

  const handleAddWallet = () => {
    setShowAddWalletOptions(true);
  };

  const handleAddWalletSuccess = async () => {
    setShowAddWalletOptions(false);
    // 等待一小段时间确保保存完成
    await new Promise(resolve => setTimeout(resolve, 500));
    // 重新加载钱包列表
    await loadWallets();
  };

  const handleImport = async (
    type: WalletType,
    credentials: { mnemonic?: string; privateKey?: string },
    password: string
  ) => {
    try {
      await importWallet(type, credentials, password);
      setShowImport(false);
      setShowAddWallet(false);
      // 等待一小段时间确保保存完成
      await new Promise(resolve => setTimeout(resolve, 500));
      // 重新加载钱包列表
      await loadWallets();
    } catch (err) {
      console.error('Failed to import wallet:', err);
      throw err;
    }
  };

  const handleMetaMaskImport = async (mnemonic: string, password: string) => {
    try {
      await importWallet(WalletType.MNEMONIC, { mnemonic }, password);
      setShowMetaMaskImport(false);
      setShowAddWallet(false);
      // 等待一小段时间确保保存完成
      await new Promise(resolve => setTimeout(resolve, 500));
      // 重新加载钱包列表
      await loadWallets();
    } catch (err) {
      console.error('Failed to import MetaMask wallet:', err);
      throw err;
    }
  };

  const handleDeleteWallet = async (walletId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发卡片点击事件
    
    if (!confirm('确定要删除这个钱包吗？\n\n此操作将删除加密私钥数据，此操作不可恢复。')) {
      return;
    }

    try {
      const result = await deleteWallet(walletId);
      if (result.success) {
        // 如果删除的是当前选中的钱包，清除选中状态
        if (selectedWalletId === walletId) {
          setSelectedWalletId(null);
          localStorage.removeItem('selectedWalletId');
        }
        // 清除本地存储的别名
        localStorage.removeItem(`wallet_alias_${walletId}`);
        // 重新加载钱包列表
        await loadWallets();
        // 触发钱包变化事件
        window.dispatchEvent(new CustomEvent('walletChanged'));
      } else {
        setErrorMessage(`删除失败: ${result.error || '未知错误，请重试'}`);
      }
    } catch (err: any) {
      console.error('Failed to delete wallet:', err);
      setErrorMessage(`删除失败: ${err.message || '未知错误，请重试'}`);
    }
  };

  const handleDeriveAccount = async (walletId: string, currentAccountCount: number) => {
    try {
      setDerivingAccount(walletId);
      
      // 1. 找到主账户的 walletId（accountIndex = 0），用于缓存键
      // 因为同一钱包的所有账户共享同一个加密数据，所以使用主账户作为缓存键
      let mainAccountWalletId = walletId;
      const accountInfo = getSelectedAccountInfo();
      if (accountInfo?.wallet?.accounts && accountInfo.wallet.accounts.length > 0) {
        const mainAccount = accountInfo.wallet.accounts.find(acc => (acc.accountIndex ?? 0) === 0);
        if (mainAccount) {
          mainAccountWalletId = mainAccount.walletId;
        }
      }
      
      // 2. 检查内存中是否有缓存的密钥和密码
      let password: string | undefined = undefined;
      let cachedKey = getCachedKey(mainAccountWalletId);
      
      if (cachedKey) {
        // 使用缓存的密码
        password = cachedKey.password;
        console.log('[WalletPage] 使用缓存的密码派生账户');
      } else {
        // 3. 如果没有缓存，显示密码输入对话框
        let passwordResolved = false;
        
        const callback = async (inputPassword: string) => {
          try {
            if (!inputPassword || inputPassword.trim() === '') {
              setErrorMessage('请输入密码');
              return;
            }
            
            password = inputPassword;
            console.log('[WalletPage] 使用密码解密钱包，walletId:', mainAccountWalletId);
            
            // 4. 使用密码解密钱包数据并缓存到内存
            const walletResult = await getWallet({ 
              walletId: mainAccountWalletId, 
              password: password 
            });
            
            if (!walletResult.success) {
              setErrorMessage(`解密失败: ${walletResult.error || '密码错误，请重试'}`);
              // 保持对话框打开，让用户重新输入
              return;
            }
            
            // 缓存解密后的密钥和密码（使用主账户的 walletId 作为缓存键）
            if (walletResult.mnemonic || walletResult.privateKey) {
              cacheKey(mainAccountWalletId, {
                password: password,
                mnemonic: walletResult.mnemonic,
                privateKey: walletResult.privateKey,
              });
              console.log('[WalletPage] 已缓存密钥和密码到内存');
            }
            
            setShowPasswordDialog(false);
            setPasswordDialogCallback(null);
            passwordCallbackRef.current = null;
            setErrorMessage(null);
            passwordResolved = true;
            
            if (resolvePromiseRef.current) {
              resolvePromiseRef.current();
              resolvePromiseRef.current = null;
            }
          } catch (err: any) {
            console.error('[WalletPage] 解密钱包失败:', err);
            setErrorMessage(`解密失败: ${err.message || '密码错误，请重试'}`);
            // 保持对话框打开，让用户重新输入
          }
        };
        
        // 先设置 ref（同步），确保回调函数立即可用
        passwordCallbackRef.current = callback;
        // 然后设置 state（异步）
        setPasswordDialogCallback(callback);
        // 使用 flushSync 确保状态更新立即生效，或者使用 setTimeout 延迟显示对话框
        // 但更好的方法是确保 ref 已经设置，然后显示对话框
        // 由于 ref 是同步的，我们可以立即显示对话框
        setShowPasswordDialog(true);
        
        // 等待密码输入完成
        await new Promise<void>((resolve) => {
          resolvePromiseRef.current = resolve;
        });
        
        if (!passwordResolved || !password) {
          setDerivingAccount(null);
          setShowPasswordDialog(false);
          setPasswordDialogCallback(null);
          passwordCallbackRef.current = null;
          resolvePromiseRef.current = null;
          return;
        }
      }
      
      // 5. 使用密码派生新账户（使用传入的 walletId，可能是任意账户）
      const result = await deriveAccount(walletId, currentAccountCount, password);
      if (result.success) {
        // 重新加载钱包列表
        await loadWallets();
        // 触发钱包变化事件
        window.dispatchEvent(new CustomEvent('walletChanged'));
        setErrorMessage(null);
      } else {
        setErrorMessage(`派生失败: ${result.error || '未知错误，请重试'}`);
      }
    } catch (err: any) {
      console.error('Failed to derive account:', err);
      setErrorMessage(`派生失败: ${err.message || '未知错误，请重试'}`);
    } finally {
      setDerivingAccount(null);
    }
  };

  return (
    <div className="flex gap-6 h-full p-6">
      {/* 左侧钱包列表 */}
      <aside className="w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">钱包列表</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : wallets.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
              <p>暂无钱包</p>
              <p className="mt-2">点击下方 + 按钮添加</p>
            </div>
          ) : (
            <div className="space-y-2">
              {wallets.map((wallet) => {
                const accounts = wallet.accounts || [];
                const hasAccounts = accounts.length > 0;
                
                // 获取钱包的主账户（accountIndex = 0 或第一个账户）
                const mainAccount = hasAccounts 
                  ? accounts.find(acc => (acc.accountIndex || 0) === 0) || accounts[0]
                  : null;
                
                return (
                  <div key={wallet.walletId} className="space-y-1">
                    {/* 钱包主卡片 */}
                    <Card
                      className={`cursor-pointer transition-colors group ${
                        selectedWalletId === wallet.walletId && !hasAccounts
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => {
                        if (hasAccounts && mainAccount) {
                          handleWalletSelect(mainAccount.walletId);
                        } else {
                          handleWalletSelect(wallet.walletId);
                        }
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          <WalletIcon className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {getWalletDisplayName(wallet)}
                            </p>
                            {hasAccounts && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {accounts.length} 个账户
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 dark:hover:bg-red-900/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWallet(wallet.walletId, e);
                            }}
                            title="删除钱包"
                          >
                            <Trash2 className="h-3 w-3 text-red-600 dark:text-red-400" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 添加钱包按钮 */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <Button
            onClick={handleAddWallet}
            className="w-full"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加
          </Button>
        </div>
      </aside>

      {/* 添加钱包选项弹窗 */}
      {showAddWalletOptions && (
        <AddWalletOptions
          onClose={() => setShowAddWalletOptions(false)}
          onSuccess={handleAddWalletSuccess}
          onImport={handleImport}
          onMetaMaskImport={handleMetaMaskImport}
        />
      )}

      {/* 右侧主内容区 */}
      <div className="flex-1 space-y-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              钱包管理
            </h2>
            {/* 账户下拉选择框 */}
            {(() => {
              const accountInfo = getSelectedAccountInfo();
              const accounts = getCurrentWalletAccounts();
              
              if (accountInfo && accounts.length > 0) {
                return (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">账户:</span>
                    <Select
                      value={selectedWalletId || undefined}
                      onValueChange={(value) => {
                        if (value === '__add_account__') {
                          // 添加账户
                          const currentAccountCount = accounts.length;
                          handleDeriveAccount(accountInfo.wallet.walletId, currentAccountCount);
                        } else {
                          // 选择账户
                          handleWalletSelect(value);
                        }
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="选择账户" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          .sort((a, b) => (a.accountIndex || 0) - (b.accountIndex || 0))
                          .map((account) => (
                            <SelectItem key={account.walletId} value={account.walletId}>
                              账户: Account #{account.accountIndex ?? 0}
                            </SelectItem>
                          ))}
                        <SelectSeparator />
                        <SelectItem 
                          value="__add_account__"
                          disabled={derivingAccount === accountInfo.wallet.walletId}
                        >
                          {derivingAccount === accountInfo.wallet.walletId ? (
                            <span className="flex items-center">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              派生中...
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <Plus className="h-3 w-3 mr-1" />
                              添加账号
                            </span>
                          )}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {showImport && (
          <ImportWallet
            onImport={handleImport}
            onCancel={() => {
              setShowImport(false);
              setShowAddWallet(false);
            }}
          />
        )}

        {showMetaMaskImport && (
          <MetaMaskImport
            onImport={handleMetaMaskImport}
            onCancel={() => {
              setShowMetaMaskImport(false);
              setShowAddWallet(false);
            }}
          />
        )}

        {!showImport && !showMetaMaskImport && <WalletConnector walletId={selectedWalletId} />}

        <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>支持 OneKey、Ledger、Trezor 硬件钱包</p>
          <p className="mt-2">您的私钥永远不会离开硬件设备</p>
        </div>
      </div>

      {/* 密码输入对话框 */}
      {showPasswordDialog && (passwordCallbackRef.current || passwordDialogCallback) && (
        <PasswordDialog
          mode="verify"
          title="输入钱包密码"
          description="请输入钱包密码以派生新账户。密码将用于解密钱包数据。"
          error={errorMessage || undefined}
          onSubmit={(() => {
            // 优先使用 ref（同步），然后使用 state
            const cb = passwordCallbackRef.current || passwordDialogCallback;
            if (cb && typeof cb === 'function') {
              return cb;
            }
            console.error('[WalletPage] 密码回调函数未设置', { 
              ref: passwordCallbackRef.current, 
              state: passwordDialogCallback 
            });
            return async () => {
              setErrorMessage('系统错误：密码回调函数未正确初始化');
            };
          })()}
          onCancel={() => {
            setShowPasswordDialog(false);
            setPasswordDialogCallback(null);
            passwordCallbackRef.current = null;
            setErrorMessage(null);
            setDerivingAccount(null);
            // 如果 Promise 还在等待，resolve 它
            if (resolvePromiseRef.current) {
              resolvePromiseRef.current();
              resolvePromiseRef.current = null;
            }
          }}
        />
      )}

      {/* 错误提示 */}
      {errorMessage && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
          <Card className="border-destructive bg-destructive/10 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-destructive">操作失败</p>
                  <p className="text-sm text-destructive/80 mt-1 wrap-break-word">{errorMessage}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setErrorMessage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
