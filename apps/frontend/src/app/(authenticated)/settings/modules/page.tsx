'use client';

import { useState, useEffect } from 'react';
import { Upload, Package, CheckCircle, AlertTriangle, Trash2, Power, PowerOff } from 'lucide-react';
import axios from 'axios';

interface Module {
    id: string;
    slug: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    category?: string;
    enabled: boolean;
    validated: boolean;
    sandboxed: boolean;
    uploadedAt: string;
    pagesCount: number;
    permissionsCount: number;
}

export default function ModulesManagementPage() {
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);

    useEffect(() => {
        loadModules();
    }, []);

    const loadModules = async () => {
        try {
            const response = await axios.get('/api/modules');
            setModules(response.data.data || []);
        } catch (error) {
            console.error('Erro ao carregar módulos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setSelectedFile(e.dataTransfer.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await axios.post('/api/modules/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                alert('Módulo enviado com sucesso!');
                setSelectedFile(null);
                loadModules();
            } else {
                alert('Erro ao enviar módulo: ' + response.data.message);
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                alert('Erro ao enviar módulo: ' + error.message);
            } else {
                alert('Erro ao enviar módulo: Erro desconhecido');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleValidate = async (id: string) => {
        try {
            await axios.post(`/api/modules/${id}/validate`);
            alert('Módulo validado com sucesso!');
            loadModules();
        } catch (error) {
            alert('Erro ao validar módulo');
        }
    };

    const handleEnable = async (id: string) => {
        try {
            await axios.post(`/api/modules/${id}/enable`);
            alert('Módulo ativado com sucesso!');
            loadModules();
        } catch (error: unknown) {
            if (error instanceof Error) {
                alert('Erro ao ativar módulo: ' + error.message);
            } else {
                alert('Erro ao ativar módulo: Erro desconhecido');
            }
        }
    };

    const handleDisable = async (id: string) => {
        try {
            await axios.post(`/api/modules/${id}/disable`);
            alert('Módulo desativado com sucesso!');
            loadModules();
        } catch (error) {
            alert('Erro ao desativar módulo');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este módulo?')) return;

        try {
            await axios.delete(`/api/modules/${id}`);
            alert('Módulo removido com sucesso!');
            loadModules();
        } catch (error) {
            alert('Erro ao remover módulo');
        }
    };

    return (
        <div className="container mx-auto py-6 px-4 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Gerenciamento de Módulos
                </h1>
                <p className="text-gray-600">
                    Faça upload, valide e gerencie módulos do sistema
                </p>
            </div>

            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload de Módulo
                </h2>

                <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />

                    {selectedFile ? (
                        <div className="mb-4">
                            <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                            <p className="text-xs text-gray-500">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                    ) : (
                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">
                                Arraste um arquivo .zip ou clique para selecionar
                            </p>
                            <p className="text-xs text-gray-500">Tamanho máximo: 50MB</p>
                        </div>
                    )}

                    <div className="flex gap-2 justify-center">
                        <label className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 cursor-pointer transition-colors">
                            Selecionar Arquivo
                            <input
                                type="file"
                                accept=".zip"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </label>

                        {selectedFile && (
                            <>
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                                >
                                    {uploading ? 'Enviando...' : 'Enviar Módulo'}
                                </button>
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Modules List */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Módulos Instalados</h2>

                {loading ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600 mt-2">Carregando módulos...</p>
                    </div>
                ) : modules.length === 0 ? (
                    <div className="text-center py-8">
                        <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600">Nenhum módulo instalado</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {modules.map((module) => (
                            <div
                                key={module.id}
                                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-lg font-semibold">{module.name}</h3>
                                            <span className="text-sm text-gray-500">v{module.version}</span>

                                            {module.enabled ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                                    Ativo
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                                    Inativo
                                                </span>
                                            )}

                                            {module.validated ? (
                                                <CheckCircle className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                            )}

                                            {module.sandboxed && (
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                                    Sandbox
                                                </span>
                                            )}
                                        </div>

                                        {module.description && (
                                            <p className="text-sm text-gray-600 mb-2">{module.description}</p>
                                        )}

                                        <div className="flex gap-4 text-xs text-gray-500">
                                            {module.author && <span>Autor: {module.author}</span>}
                                            {module.category && <span>Categoria: {module.category}</span>}
                                            <span>{module.pagesCount} página(s)</span>
                                            <span>{module.permissionsCount} permissão(ões)</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 ml-4">
                                        {!module.validated && (
                                            <button
                                                onClick={() => handleValidate(module.id)}
                                                className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                                                title="Validar"
                                            >
                                                <CheckCircle className="h-5 w-5" />
                                            </button>
                                        )}

                                        {module.validated && !module.enabled && (
                                            <button
                                                onClick={() => handleEnable(module.id)}
                                                className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                                title="Ativar"
                                            >
                                                <Power className="h-5 w-5" />
                                            </button>
                                        )}

                                        {module.enabled && (
                                            <button
                                                onClick={() => handleDisable(module.id)}
                                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                                                title="Desativar"
                                            >
                                                <PowerOff className="h-5 w-5" />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleDelete(module.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                            title="Remover"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
