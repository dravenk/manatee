/**
 * 订单支付页面
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useWallet } from '@/hooks/useWallet';
import { ShoppingCart, CheckCircle2, XCircle } from 'lucide-react';

interface Order {
  id: string;
  amount: number;
  currency: string;
  description: string;
  status: 'pending' | 'paid' | 'failed';
  createdAt: string;
}

export function OrderPage() {
  const { connection } = useWallet();
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrder, setNewOrder] = useState({
    amount: '',
    currency: 'USDT',
    description: '',
  });

  const handleCreateOrder = () => {
    if (!newOrder.amount || !newOrder.description) {
      return;
    }

    const order: Order = {
      id: `ORD-${Date.now()}`,
      amount: parseFloat(newOrder.amount),
      currency: newOrder.currency,
      description: newOrder.description,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    setOrders([order, ...orders]);
    setNewOrder({ amount: '', currency: 'USDT', description: '' });
  };

  const handlePayOrder = async (orderId: string) => {
    if (!connection) {
      alert('请先连接钱包');
      return;
    }

    // 更新订单状态
    setOrders(orders.map(order => 
      order.id === orderId 
        ? { ...order, status: 'paid' }
        : order
    ));
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return '待支付';
      case 'paid':
        return '已支付';
      case 'failed':
        return '支付失败';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          订单支付
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          创建订单并使用数字货币进行支付
        </p>
      </div>

      {/* 创建订单 */}
      <Card>
        <CardHeader>
          <CardTitle>创建新订单</CardTitle>
          <CardDescription>
            填写订单信息并创建支付订单
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">金额</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={newOrder.amount}
              onChange={(e) => setNewOrder({ ...newOrder, amount: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">币种</Label>
            <select
              id="currency"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={newOrder.currency}
              onChange={(e) => setNewOrder({ ...newOrder, currency: e.target.value })}
            >
              <option value="USDT">USDT (TRC20)</option>
              <option value="TRX">TRX</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">订单描述</Label>
            <Input
              id="description"
              placeholder="请输入订单描述"
              value={newOrder.description}
              onChange={(e) => setNewOrder({ ...newOrder, description: e.target.value })}
            />
          </div>

          <Button 
            onClick={handleCreateOrder}
            disabled={!newOrder.amount || !newOrder.description}
            className="w-full"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            创建订单
          </Button>
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <Card>
        <CardHeader>
          <CardTitle>订单列表</CardTitle>
          <CardDescription>
            查看和管理您的订单
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              暂无订单
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{order.id}</span>
                      {getStatusIcon(order.status)}
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {getStatusText(order.status)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {order.amount} {order.currency}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(order.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {order.description}
                  </div>

                  {order.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handlePayOrder(order.id)}
                        disabled={!connection}
                      >
                        支付订单
                      </Button>
                      {!connection && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 self-center">
                          请先连接钱包
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
