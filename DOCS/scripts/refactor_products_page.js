
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
import { Search, Plus, Edit, Package } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function OrdemServicoProdutosPage() {
    const { toast } = useToast();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // State do Dialog
    const [isOpen, setIsOpen] = useState(false);
    
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
        console.log('PRODUTOS PAGE MOUNTED');
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

    const handleOpenNew = () => {
        console.log('Botão Novo Item Clicado');
        setEditingId(null);
        setFormData({
            code: '',
            name: '',
            price: '',
            description: '',
            is_active: true
        });
        setIsOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const priceVal = parseFloat(formData.price.toString().replace(',', '.'));
            
            const payload = { ...formData, price: priceVal };

            if (editingId) {
                await api.put(\`/api/ordem_servico/produtos/\${editingId}\`, payload);
                toast({ title: 'Atualizado com sucesso!' });
            } else {
                await api.post('/api/ordem_servico/produtos', payload);
                toast({ title: 'Criado com sucesso!' });
            }
            setIsOpen(false);
            fetchProducts();
        } catch (error: any) {
            toast({ 
                title: 'Erro', 
                description: error.response?.data?.message || 'Erro ao salvar',
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Produtos e Serviços</h1>
                    <p className="text-muted-foreground mt-2">
                        Gerenciamento de catálogo
                    </p>
                </div>
                
                {/* BOTÃO REFATORADO */}
                <Button 
                    onClick={handleOpenNew} 
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                    <Plus className="h-4 w-4" />
                    Adicionar Novo Item
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Lista de Itens</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                       <div className="p-4 text-center">Carregando...</div>
                    ) : (
                        <div className="border rounded-md">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="p-3">Código</th>
                                        <th className="p-3">Nome</th>
                                        <th className="p-3">Preço</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map(p => (
                                        <tr key={p.id} className="border-t hover:bg-muted/50">
                                            <td className="p-3 font-mono">{p.code}</td>
                                            <td className="p-3">{p.name}</td>
                                            <td className="p-3 text-green-600 font-bold">
                                                R$ {parseFloat(p.price).toFixed(2)}
                                            </td>
                                            <td className="p-3">
                                                <Badge variant={p.is_active ? 'default' : 'secondary'}>
                                                    {p.is_active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-right">
                                                <Button size="icon" variant="ghost" onClick={() => {
                                                    setEditingId(p.id);
                                                    setFormData({
                                                        code: p.code,
                                                        name: p.name,
                                                        price: p.price,
                                                        description: p.description,
                                                        is_active: p.is_active
                                                    });
                                                    setIsOpen(true);
                                                }}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {products.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                Nenhum produto cadastrado.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Editar' : 'Novo'} Produto</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Código</Label>
                            <Input 
                                value={formData.code}
                                onChange={e => setFormData({...formData, code: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Nome</Label>
                            <Input 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Preço</Label>
                            <Input 
                                type="number"
                                value={formData.price}
                                onChange={e => setFormData({...formData, price: e.target.value})}
                            />
                        </div>
                         <div className="flex items-center space-x-2">
                            <Switch
                                id="status"
                                checked={formData.is_active}
                                onCheckedChange={c => setFormData({...formData, is_active: c})}
                            />
                            <Label htmlFor="status">Ativo</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
`;

fs.writeFileSync(targetPath, content);
console.log('✅ Page Refatorada com sucesso!');
