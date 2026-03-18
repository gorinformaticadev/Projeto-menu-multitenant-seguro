'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Package, Power, PowerOff, Trash2, Upload } from 'lucide-react';
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
            console.error('Erro ao carregar mÃ³dulos:', error);
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
                alert('MÃ³dulo enviado com sucesso!');
                setSelectedFile(null);
                loadModules();
            } else {
                alert(`Erro ao enviar mÃ³dulo: ${response.data.message}`);
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                alert(`Erro ao enviar mÃ³dulo: ${error.message}`);
            } else {
                alert('Erro ao enviar mÃ³dulo: Erro desconhecido');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleValidate = async (id: string) => {
        try {
            await axios.post(`/api/modules/${id}/validate`);
            alert('MÃ³dulo validado com sucesso!');
            loadModules();
        } catch {
            alert('Erro ao validar mÃ³dulo');
        }
    };

    const handleEnable = async (id: string) => {
        try {
            await axios.post(`/api/modules/${id}/enable`);
            alert('MÃ³dulo ativado com sucesso!');
            loadModules();
        } catch (error: unknown) {
            if (error instanceof Error) {
                alert(`Erro ao ativar mÃ³dulo: ${error.message}`);
            } else {
                alert('Erro ao ativar mÃ³dulo: Erro desconhecido');
            }
        }
    };

    const handleDisable = async (id: string) => {
        try {
            await axios.post(`/api/modules/${id}/disable`);
            alert('MÃ³dulo desativado com sucesso!');
            loadModules();
        } catch {
            alert('Erro ao desativar mÃ³dulo');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover este mÃ³dulo?')) return;

        try {
            await axios.delete(`/api/modules/${id}`);
            alert('MÃ³dulo removido com sucesso!');
            loadModules();
        } catch {
            alert('Erro ao remover mÃ³dulo');
        }
    };

    return (
        <div className="container mx-auto max-w-7xl px-4 py-6 text-skin-text dark:text-skin-text">
            <div className="mb-8">
                <h1 className="mb-2 text-3xl font-bold text-skin-text dark:text-skin-text">
                    Gerenciamento de MÃ³dulos
                </h1>
                <p className="text-skin-text-muted ">
                    FaÃ§a upload, valide e gerencie mÃ³dulos do sistema
                </p>
            </div>

            <div className="mb-8 rounded-lg bg-skin-surface p-6 shadow-md dark:border dark:border-skin-border/80 dark:bg-skin-surface/55">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-skin-text dark:text-skin-text">
                    <Upload className="h-5 w-5" />
                    Upload de MÃ³dulo
                </h2>

                <div
                    className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                        dragActive
                            ? 'border-skin-info/30 bg-skin-info/10 dark:border-skin-info/30 '
                            : 'border-skin-border-strong hover:border-skin-border-strong dark:border-skin-border '
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <Package className="mx-auto mb-4 h-12 w-12 text-skin-text-muted dark:text-skin-text-muted" />

                    {selectedFile ? (
                        <div className="mb-4">
                            <p className="text-sm font-medium text-skin-text dark:text-skin-text">{selectedFile.name}</p>
                            <p className="text-xs text-skin-text-muted dark:text-skin-text-muted">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                    ) : (
                        <div className="mb-4">
                            <p className="mb-2 text-sm text-skin-text-muted ">
                                Arraste um arquivo .zip ou clique para selecionar
                            </p>
                            <p className="text-xs text-skin-text-muted dark:text-skin-text-muted">Tamanho mÃ¡ximo: 50MB</p>
                        </div>
                    )}

                    <div className="flex justify-center gap-2">
                        <label className="cursor-pointer rounded-md bg-skin-background-elevated px-4 py-2 text-skin-text transition-colors hover:bg-skin-border dark:bg-skin-background-elevated/70  dark:hover:bg-skin-background-elevated">
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
                                    className="rounded-md bg-skin-primary px-4 py-2 text-white transition-colors hover:bg-skin-primary-hover disabled:bg-skin-border dark:disabled:bg-skin-border"
                                >
                                    {uploading ? 'Enviando...' : 'Enviar MÃ³dulo'}
                                </button>
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="rounded-md bg-skin-danger px-4 py-2 text-white transition-colors hover:bg-skin-danger"
                                >
                                    Cancelar
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-lg bg-skin-surface p-6 shadow-md dark:border dark:border-skin-border/80 dark:bg-skin-surface/55">
                <h2 className="mb-4 text-xl font-semibold text-skin-text dark:text-skin-text">MÃ³dulos Instalados</h2>

                {loading ? (
                    <div className="py-8 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-skin-primary"></div>
                        <p className="mt-2 text-skin-text-muted ">Carregando mÃ³dulos...</p>
                    </div>
                ) : modules.length === 0 ? (
                    <div className="py-8 text-center">
                        <Package className="mx-auto mb-4 h-12 w-12 text-skin-text-muted dark:text-skin-text-muted" />
                        <p className="text-skin-text-muted ">Nenhum mÃ³dulo instalado</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {modules.map((module) => (
                            <div
                                key={module.id}
                                className="rounded-lg border p-4 transition-shadow hover:shadow-md dark:border-skin-border/80 dark:bg-skin-surface/40"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="mb-2 flex items-center gap-2">
                                            <h3 className="text-lg font-semibold">{module.name}</h3>
                                            <span className="text-sm text-skin-text-muted dark:text-skin-text-muted">v{module.version}</span>

                                            {module.enabled ? (
                                                <span className="rounded-full bg-skin-success/15 px-2 py-1 text-xs text-skin-success  dark:text-skin-success">
                                                    Ativo
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-skin-background-elevated px-2 py-1 text-xs text-skin-text dark:bg-skin-background-elevated/70 ">
                                                    Inativo
                                                </span>
                                            )}

                                            {module.validated ? (
                                                <CheckCircle className="h-4 w-4 text-skin-success" />
                                            ) : (
                                                <AlertTriangle className="h-4 w-4 text-skin-warning" />
                                            )}

                                            {module.sandboxed && (
                                                <span className="rounded-full bg-skin-info/15 px-2 py-1 text-xs text-skin-info  dark:text-skin-info">
                                                    Sandbox
                                                </span>
                                            )}
                                        </div>

                                        {module.description && (
                                            <p className="mb-2 text-sm text-skin-text-muted ">{module.description}</p>
                                        )}

                                        <div className="flex gap-4 text-xs text-skin-text-muted dark:text-skin-text-muted">
                                            {module.author && <span>Autor: {module.author}</span>}
                                            {module.category && <span>Categoria: {module.category}</span>}
                                            <span>{module.pagesCount} pÃ¡gina(s)</span>
                                            <span>{module.permissionsCount} permissÃ£o(Ãµes)</span>
                                        </div>
                                    </div>

                                    <div className="ml-4 flex gap-2">
                                        {!module.validated && (
                                            <button
                                                onClick={() => handleValidate(module.id)}
                                                className="rounded-md p-2 text-skin-warning transition-colors hover:bg-skin-warning/10 "
                                                title="Validar"
                                            >
                                                <CheckCircle className="h-5 w-5" />
                                            </button>
                                        )}

                                        {module.validated && !module.enabled && (
                                            <button
                                                onClick={() => handleEnable(module.id)}
                                                className="rounded-md p-2 text-skin-success transition-colors hover:bg-skin-success/10 "
                                                title="Ativar"
                                            >
                                                <Power className="h-5 w-5" />
                                            </button>
                                        )}

                                        {module.enabled && (
                                            <button
                                                onClick={() => handleDisable(module.id)}
                                                className="rounded-md p-2 text-skin-warning transition-colors hover:bg-skin-warning/10 dark:hover:bg-skin-warning/10"
                                                title="Desativar"
                                            >
                                                <PowerOff className="h-5 w-5" />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => handleDelete(module.id)}
                                            className="rounded-md p-2 text-skin-danger transition-colors hover:bg-skin-danger/10 "
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


