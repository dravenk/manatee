/**
 * 查看私钥和助记词组件
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getWallet } from '@/lib/api/wallet';
import { walletManager } from '@/lib/wallet/manager';
import { WalletType } from '@/types/wallet';

interface ViewCredentialsProps {
  walletId: string;
  onClose: () => void;
}

export function ViewCredentials({ walletId, onClose }: ViewCredentialsProps) {
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [mnemonic, setMnemonic] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [connection, setConnection] = useState<any>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<'software' | 'hardware' | null>(null);

  // 检查当前连接的钱包
  useEffect(() => {
    const currentConnection = walletManager.getCurrentConnection();
    setConnection(currentConnection);
    
    // 如果是硬件钱包，自动加载公钥
    if (currentConnection && (
      currentConnection.type === WalletType.ONEKEY ||
      currentConnection.type === WalletType.LEDGER ||
      currentConnection.type === WalletType.TREZOR
    )) {
      // 硬件钱包直接显示当前连接的公钥
      setPublicKey(currentConnection.publicKey || null);
      setWalletType('hardware');
    }
  }, []);

  const handleDecrypt = async () => {
    setError('');
    setLoading(true);
    
    try {
      // 如果是硬件钱包且已有连接，直接使用连接的公钥
      if (walletType === 'hardware' && connection?.publicKey) {
        setPublicKey(connection.publicKey);
        setLoading(false);
        return;
      }

      // 尝试从服务器读取（硬件钱包不需要密码）
      // 如果 walletId 包含 'temp'，说明是临时 ID，直接使用当前连接
      if (walletId.includes('_temp') && connection) {
        setPublicKey(connection.publicKey || null);
        setWalletType('hardware');
        setLoading(false);
        return;
      }

      const result = await getWallet({ walletId, password: password || undefined });
      
      if (!result.success) {
        throw new Error(result.error || '获取钱包数据失败');
      }
      
      // 如果是硬件钱包，只显示公钥和地址
      if (result.walletType === 'hardware') {
        setPrivateKey(null);
        setMnemonic(null);
        setPublicKey(result.publicKey || null);
        setWalletType('hardware');
        return;
      }
      
      // 软件钱包显示私钥和助记词
      setPrivateKey(result.privateKey || null);
      setMnemonic(result.mnemonic || null);
      setPublicKey(result.publicKey || null);
      setWalletType('software');
      
      if (!result.privateKey && !result.mnemonic) {
        setError('未找到私钥或助记词');
      }
    } catch (err: any) {
      // 如果获取失败，但当前有连接，使用当前连接的公钥
      if (connection?.publicKey && walletType === 'hardware') {
        setPublicKey(connection.publicKey);
        setError('');
      } else {
        setError(err.message || '密码错误或数据损坏');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>查看钱包信息</CardTitle>
          <CardDescription>
            {privateKey || mnemonic 
              ? '请确保在安全的环境中操作。'
              : '硬件钱包可以直接查看公钥，软件钱包需要输入密码查看私钥和助记词。'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!privateKey && !mnemonic && !publicKey && !loading ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="view-password">密码（硬件钱包不需要）</Label>
                <Input
                  id="view-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="请输入密码（硬件钱包留空）"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleDecrypt}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? '加载中...' : '查看'}
                </Button>
              </div>
            </>
          ) : (
            <>
              {walletType === 'hardware' ? (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    ℹ️ 硬件钱包信息
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    硬件钱包的私钥存储在硬件设备中，这里只显示公钥和地址。
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    ⚠️ 安全警告
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    私钥和助记词是您钱包的完整控制权。请勿分享给任何人，不要在网络上传输或存储。
                  </p>
                </div>
              )}

              {privateKey && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>私钥</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                      >
                        {showPrivateKey ? '隐藏' : '显示'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(privateKey)}
                      >
                        复制
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={showPrivateKey ? privateKey : '•'.repeat(64)}
                    readOnly
                    rows={2}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {mnemonic && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>助记词</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMnemonic(!showMnemonic)}
                      >
                        {showMnemonic ? '隐藏' : '显示'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(mnemonic)}
                      >
                        复制
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={showMnemonic ? mnemonic : '•'.repeat(mnemonic.length)}
                    readOnly
                    rows={3}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {/* 显示公钥（硬件钱包或软件钱包） */}
              {publicKey && (
                <div className="space-y-2">
                  <Label>公钥</Label>
                  <Textarea
                    value={publicKey}
                    readOnly
                    rows={3}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(publicKey)}
                    className="w-full"
                  >
                    复制公钥
                  </Button>
                </div>
              )}

              {/* 显示地址 */}
              {connection?.address && (
                <div className="space-y-2">
                  <Label>地址</Label>
                  <Textarea
                    value={connection.address}
                    readOnly
                    rows={2}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(connection.address)}
                    className="w-full"
                  >
                    复制地址
                  </Button>
                </div>
              )}

              <Button onClick={onClose} className="w-full">
                关闭
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
