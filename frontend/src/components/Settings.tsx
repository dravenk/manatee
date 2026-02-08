/**
 * Settings 设置组件
 * 用于选择当前使用的钱包账号和管理网络配置
 */

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Check, Loader2, Wallet, Network, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { listWallets, getPublicKeyFromServer } from '../lib/api/wallet';
import type { GetPublicKeyRequest } from '../lib/api/wallet';
import { walletManager } from '../lib/wallet/manager';
import { NetworkSettings } from './NetworkSettings';
import { ExportImport } from './ExportImport';

interface WalletInfo {
  walletId: string;
  address?: string;
  publicKey?: string;
}

type SettingsTab = 'wallet' | 'network' | 'export';

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('wallet');
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  // 加载钱包列表
  useEffect(() => {
    const loadWallets = async () => {
      try {
        setLoading(true);
        setError('');
        
        // 获取所有钱包 ID
        const result = await listWallets();
        if (!result.success || !result.walletIds || result.walletIds.length === 0) {
          setWallets([]);
          return;
        }

        // 获取每个钱包的地址和公钥
        const walletInfos: WalletInfo[] = [];
        for (const walletId of result.walletIds) {
          try {
            const publicKeyResult = await getPublicKeyFromServer({ walletId } as GetPublicKeyRequest);
            if (publicKeyResult.success && publicKeyResult.address) {
              walletInfos.push({
                walletId,
                address: publicKeyResult.address,
                publicKey: publicKeyResult.publicKey,
              });
            } else {
              walletInfos.push({ walletId });
            }
          } catch (err: any) {
            console.warn(`Failed to get public key for wallet ${walletId}:`, err);
            walletInfos.push({ walletId });
          }
        }

        setWallets(walletInfos);

        // 从本地存储读取当前选中的钱包
        const savedWalletId = localStorage.getItem('selectedWalletId');
        if (savedWalletId && result.walletIds.includes(savedWalletId)) {
          setSelectedWalletId(savedWalletId);
        } else if (walletInfos.length > 0) {
          // 如果没有保存的选择，使用第一个钱包
          setSelectedWalletId(walletInfos[0].walletId);
        }
      } catch (err: any) {
        console.error('Failed to load wallets:', err);
        setError(err.message || '加载钱包列表失败');
      } finally {
        setLoading(false);
      }
    };

    loadWallets();
  }, []);

  // 保存选中的钱包
  const handleSave = async () => {
    if (!selectedWalletId) {
      setError('请选择一个钱包');
      return;
    }

    try {
      setSaving(true);
      setError('');

      // 保存到本地存储
      localStorage.setItem('selectedWalletId', selectedWalletId);

      // 如果钱包已连接，断开连接
      const currentConnection = walletManager.getCurrentConnection();
      if (currentConnection) {
        await walletManager.disconnect();
      }

      // 显示成功消息
      setTimeout(() => {
        setSaving(false);
        // 可以在这里触发一个事件通知其他组件钱包已切换
        window.dispatchEvent(new CustomEvent('walletChanged', { detail: { walletId: selectedWalletId } }));
      }, 500);
    } catch (err: any) {
      console.error('Failed to save wallet selection:', err);
      setError(err.message || '保存失败');
      setSaving(false);
    }
  };

  const formatAddress = (address?: string) => {
    if (!address) return '未知地址';
    if (address.length > 20) {
      return `${address.slice(0, 10)}...${address.slice(-8)}`;
    }
    return address;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            <CardTitle>设置</CardTitle>
          </div>
          <CardDescription>
            管理钱包账号和网络配置
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 mb-4">
            <Button
              variant={activeTab === 'wallet' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('wallet')}
              className="rounded-b-none"
            >
              <Wallet className="mr-2 h-4 w-4" />
              钱包设置
            </Button>
            <Button
              variant={activeTab === 'network' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('network')}
              className="rounded-b-none"
            >
              <Network className="mr-2 h-4 w-4" />
              网络设置
            </Button>
            <Button
              variant={activeTab === 'export' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('export')}
              className="rounded-b-none"
            >
              <Download className="mr-2 h-4 w-4" />
              导出/导入
            </Button>
          </div>

          {activeTab === 'wallet' && (
            <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-600 dark:text-slate-400">加载中...</span>
          </div>
        ) : wallets.length === 0 ? (
          <div className="text-center py-8 text-slate-600 dark:text-slate-400">
            <p>暂无保存的钱包</p>
            <p className="text-sm mt-2">请先在钱包管理页面导入或连接钱包</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">选择钱包账号</label>
              <Select
                value={selectedWalletId}
                onValueChange={setSelectedWalletId}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择钱包" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((wallet) => (
                    <SelectItem key={wallet.walletId} value={wallet.walletId}>
                      <div className="flex flex-col">
                        <span className="font-medium">{formatAddress(wallet.address)}</span>
                        {wallet.walletId && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            ID: {wallet.walletId.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedWalletId && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400">钱包 ID:</span>
                    <span className="ml-2 font-mono text-slate-900 dark:text-slate-100">
                      {selectedWalletId}
                    </span>
                  </div>
                  {wallets.find(w => w.walletId === selectedWalletId)?.address && (
                    <div>
                      <span className="text-slate-600 dark:text-slate-400">地址:</span>
                      <span className="ml-2 font-mono text-slate-900 dark:text-slate-100">
                        {wallets.find(w => w.walletId === selectedWalletId)?.address}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={!selectedWalletId || saving || loading}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  保存设置
                </>
              )}
            </Button>
          </>
        )}
            </div>
          )}

          {activeTab === 'network' && <NetworkSettings />}
          {activeTab === 'export' && <ExportImport />}
        </CardContent>
      </Card>
    </div>
  );
}
