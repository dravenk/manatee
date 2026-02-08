/**
 * 网络设置组件
 * 用于管理网络配置（参考 MetaMask 的网络设置结构）
 */

import { useState, useEffect } from 'react';
import { Network, Plus, Trash2, Loader2, Save, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  listNetworks,
  saveNetwork,
  deleteNetwork,
  NetworkConfiguration,
  RpcEndpoint,
} from '../lib/api/network';

export function NetworkSettings() {
  const [networks, setNetworks] = useState<NetworkConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNetwork, setEditingNetwork] = useState<NetworkConfiguration | null>(null);

  // 表单状态
  const [formData, setFormData] = useState({
    chainId: '',
    name: '',
    nativeCurrency: '',
    rpcUrl: '',
    blockExplorerUrl: '',
  });

  // 加载网络列表
  const loadNetworks = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await listNetworks();
      if (result.success && result.networks) {
        setNetworks(result.networks);
      } else {
        setNetworks([]);
      }
    } catch (err: any) {
      console.error('Failed to load networks:', err);
      setError(err.message || '加载网络列表失败');
      setNetworks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNetworks();
  }, []);

  // 处理添加/编辑网络
  const handleSave = async () => {
    if (!formData.chainId || !formData.name || !formData.nativeCurrency || !formData.rpcUrl) {
      setError('请填写所有必填字段');
      return;
    }

    // 验证 chainId 格式
    if (!/^0x[0-9a-fA-F]+$/.test(formData.chainId)) {
      setError('Chain ID 必须是十六进制字符串（以 0x 开头）');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const network: NetworkConfiguration = {
        chainId: formData.chainId,
        name: formData.name,
        nativeCurrency: formData.nativeCurrency,
        rpcEndpoints: [
          {
            type: 'custom',
            url: formData.rpcUrl,
          },
        ],
        blockExplorerUrls: formData.blockExplorerUrl ? [formData.blockExplorerUrl] : [],
        defaultRpcEndpointIndex: 0,
        defaultBlockExplorerUrlIndex: 0,
      };

      await saveNetwork(network);
      await loadNetworks();
      setShowAddForm(false);
      setEditingNetwork(null);
      setFormData({
        chainId: '',
        name: '',
        nativeCurrency: '',
        rpcUrl: '',
        blockExplorerUrl: '',
      });
    } catch (err: any) {
      console.error('Failed to save network:', err);
      setError(err.message || '保存网络失败');
    } finally {
      setSaving(false);
    }
  };

  // 处理删除网络
  const handleDelete = async (chainId: string) => {
    if (!confirm(`确定要删除网络 ${chainId} 吗？`)) {
      return;
    }

    try {
      setError('');
      await deleteNetwork({ chainId });
      await loadNetworks();
    } catch (err: any) {
      console.error('Failed to delete network:', err);
      setError(err.message || '删除网络失败');
    }
  };

  // 开始编辑
  const handleEdit = (network: NetworkConfiguration) => {
    setEditingNetwork(network);
    setFormData({
      chainId: network.chainId,
      name: network.name,
      nativeCurrency: network.nativeCurrency,
      rpcUrl: network.rpcEndpoints[0]?.url || '',
      blockExplorerUrl: network.blockExplorerUrls?.[0] || '',
    });
    setShowAddForm(true);
  };

  // 取消编辑
  const handleCancel = () => {
    setShowAddForm(false);
    setEditingNetwork(null);
    setFormData({
      chainId: '',
      name: '',
      nativeCurrency: '',
      rpcUrl: '',
      blockExplorerUrl: '',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              <CardTitle>网络设置</CardTitle>
            </div>
            {!showAddForm && (
              <Button onClick={() => setShowAddForm(true)} variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                添加网络
              </Button>
            )}
          </div>
          <CardDescription>
            管理自定义网络配置（参考 MetaMask 的网络设置结构）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {showAddForm && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  {editingNetwork ? '编辑网络' : '添加网络'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="chainId">Chain ID *</Label>
                  <Input
                    id="chainId"
                    placeholder="0x1"
                    value={formData.chainId}
                    onChange={(e) => setFormData({ ...formData, chainId: e.target.value })}
                    disabled={saving || !!editingNetwork}
                  />
                  <p className="text-xs text-slate-500">十六进制格式，例如: 0x1, 0x38</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">网络名称 *</Label>
                  <Input
                    id="name"
                    placeholder="Ethereum Mainnet"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nativeCurrency">原生货币符号 *</Label>
                  <Input
                    id="nativeCurrency"
                    placeholder="ETH"
                    value={formData.nativeCurrency}
                    onChange={(e) => setFormData({ ...formData, nativeCurrency: e.target.value })}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rpcUrl">RPC URL *</Label>
                  <Input
                    id="rpcUrl"
                    placeholder="https://mainnet.infura.io/v3/YOUR_PROJECT_ID"
                    value={formData.rpcUrl}
                    onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="blockExplorerUrl">区块浏览器 URL</Label>
                  <Input
                    id="blockExplorerUrl"
                    placeholder="https://etherscan.io"
                    value={formData.blockExplorerUrl}
                    onChange={(e) => setFormData({ ...formData, blockExplorerUrl: e.target.value })}
                    disabled={saving}
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        保存
                      </>
                    )}
                  </Button>
                  <Button onClick={handleCancel} variant="outline" disabled={saving}>
                    <X className="mr-2 h-4 w-4" />
                    取消
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-600 dark:text-slate-400">加载中...</span>
            </div>
          ) : networks.length === 0 ? (
            <div className="text-center py-8 text-slate-600 dark:text-slate-400">
              <p>暂无网络配置</p>
              <p className="text-sm mt-2">点击上方"添加网络"按钮添加自定义网络</p>
            </div>
          ) : (
            <div className="space-y-3">
              {networks.map((network) => (
                <Card key={network.chainId} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Network className="h-4 w-4 text-slate-500" />
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            {network.name}
                          </h3>
                        </div>
                        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <p>
                            <span className="font-medium">Chain ID:</span> {network.chainId}
                          </p>
                          <p>
                            <span className="font-medium">原生货币:</span> {network.nativeCurrency}
                          </p>
                          <p>
                            <span className="font-medium">RPC URL:</span>{' '}
                            {network.rpcEndpoints[0]?.url || 'N/A'}
                          </p>
                          {network.blockExplorerUrls && network.blockExplorerUrls.length > 0 && (
                            <p>
                              <span className="font-medium">区块浏览器:</span>{' '}
                              {network.blockExplorerUrls[0]}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleEdit(network)}
                          variant="outline"
                          size="sm"
                        >
                          编辑
                        </Button>
                        <Button
                          onClick={() => handleDelete(network.chainId)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
