
const fs = require('fs');
const path = require('path');

const targetPath = path.join(process.cwd(), 'apps/frontend/src/app/modules/ordem_servico/produtos/page.tsx');

const content = `"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Search, Plus, Edit, Trash2, Tag, DollarSign, Package } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Product {
    id: string;
    code: string;
    name: string;
    price: number | string; // API can return string decimal
    description?: string;
    is_active: boolean;
    created_at: string;
}

export default function OrdemServicoProdutosPage() {
    const { toast } = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        price: '',
        description: '',
        is_active: true
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/ordem_servico/produtos');
            setProducts(response.data);
        } catch (error) {
            console.error('Erro get produtos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/ordem_servico/produtos', {
                params: { search: searchTerm }
            });
            setProducts(response.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        const num = typeof value === 'string' ? parseFloat(value) : value;
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(num || 0);
    };

    const resetForm = () => {
        setFormData({
            code: '',
            name: '',
            price: '',
            description: '',
            is_active: true
        });
        setEditingId(null);
    };

    const openNew = () => {
        console.log('Abrindo novo cadastro...');
        resetForm();
        setIsDialogOpen(true);
    };

    const openEdit = (product) => {
        setFormData({
            code: product.code,
            name: product.name,
            price: product.price.toString(),
            description: product.description || '',
            is_active: product.is_active
        });
        setEditingId(product.id);
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.code || !formData.name || !formData.price) {
            toast({
                title: 'Campos obrigatórios',
                description: 'Preencha o Código, Nome e Preço.',
                variant: 'destructive'
            });
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...formData,
                price: parseFloat(formData.price.toString().replace(',', '.'))
            };

            if (editingId) {
                await api.put(\`/api/ordem_servico/produtos/\${editingId}\`, payload);
                toast({ title: 'Item atualizado com sucesso!' });
            } else {
                await api.post('/api/ordem_servico/produtos', payload);
                toast({ title: 'Item cadastrado com sucesso!' });
            }
            setIsDialogOpen(false);
            fetchProducts();
        } catch (error) {
            toast({
                title: 'Erro ao salvar',
                description: 'Ocorreu um erro ao salvar o item.',
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (product) => {
        try {
            await api.put(\`/api/ordem_servico/produtos/\${product.id}\`, {
                ...product,
                is_active: !product.is_active
            });
            toast({ title: \`Item \${!product.is_active ? 'ativado' : 'inativado'} com sucesso\` });
            fetchProducts();
        } catch (error) {
            toast({ title: 'Erro ao alterar status', variant: 'destructive' });
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Produtos e Serviços</h1>
                    <p className="text-muted-foreground mt-2">
                        Gerencie seu catálogo de itens para ordens de serviço
                    </p>
                </div>
                <Button onClick={openNew} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo Item
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div>
                            <CardTitle>Catálogo</CardTitle>
                            <CardDescription>
                                Visualize e busque produtos e serviços cadastrados
                            </CardDescription>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nome ou código..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                            <Button variant="secondary" onClick={handleSearch}>
                                Buscar
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Código</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Nome / Descrição</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Preço</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                                <div className="flex justify-center items-center gap-2">
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                                    Carregando catálogo...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : products.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Package className="h-10 w-10 text-muted-foreground/50" />
                                                    <p className="text-lg font-semibold">Nenhum item encontrado</p>
                                                    <p className="text-sm max-w-sm mx-auto">
                                                        Não há produtos ou serviços cadastrados. Adicione o primeiro item para começar.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        products.map((product) => (
                                            <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="font-mono">
                                                            {product.code}
                                                        </Badge>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{product.name}</span>
                                                        {product.description && (
                                                            <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                                                {product.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-green-600 dark:text-green-400">
                                                    {formatCurrency(product.price)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Badge
                                                        variant={product.is_active ? 'default' : 'secondary'}
                                                        className="cursor-pointer"
                                                        onClick={() => handleToggleStatus(product)}
                                                    >
                                                        {product.is_active ? 'Ativo' : 'Inativo'}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => openEdit(product)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Editar Item' : 'Novo Produto/Serviço'}</DialogTitle>
                        <DialogDescription>
                            {editingId ? 'Atualize as informações do item.' : 'Preencha os dados do novo item do catálogo.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="code">Código *</Label>
                                <Input
                                    id="code"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    placeholder="SKU-123"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="price">Preço (R$) *</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                    <Input
                                        id="price"
                                        type="number"
                                        step="0.01"
                                        className="pl-9"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="name">Nome *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Nome do produto ou serviço"
                                />
                            </div>
                            
                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="description">Descrição</Label>
                                <Input
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Detalhes adicionais"
                                />
                            </div>

                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="active">Status</Label>
                                <div className="flex items-center space-x-2 h-10 border rounded-md px-3">
                                    <Switch
                                        id="active"
                                        checked={formData.is_active}
                                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                    />
                                    <Label htmlFor="active" className="cursor-pointer">
                                        {formData.is_active ? 'Disponível para novas ordens' : 'Indisponível (Inativo)'}
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
`;

fs.writeFileSync(targetPath, content);
console.log('✅ Arquivo page.tsx do frontend sobrescrito com sucesso!');
