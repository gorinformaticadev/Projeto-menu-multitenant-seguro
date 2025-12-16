import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export interface Demo {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  content?: string;
  status: "draft" | "published" | "archived";
  priority: number;
  viewsCount: number;
  likesCount: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  categories?: Category[];
  tags?: Tag[];
  comments?: Comment[];
  attachments?: Attachment[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color?: string;
}

export interface Comment {
  id: string;
  demoId: string;
  userId: string;
  content: string;
  createdAt: Date;
  user?: {
    name: string;
    avatar?: string;
  };
}

export interface Attachment {
  id: string;
  filename: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface DemoFilters {
  search?: string;
  status?: string;
  categoryId?: string;
  tagId?: string;
  priority?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const useDemos = (initialFilters?: DemoFilters) => {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });

  const fetchDemos = useCallback(async (filters?: DemoFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.categoryId) params.append("categoryId", filters.categoryId);
      if (filters?.tagId) params.append("tagId", filters.tagId);
      if (filters?.priority !== undefined)
        params.append("priority", String(filters.priority));
      if (filters?.sortBy) params.append("sortBy", filters.sortBy);
      if (filters?.sortOrder) params.append("sortOrder", filters.sortOrder);
      if (filters?.page) params.append("page", String(filters.page));
      if (filters?.limit) params.append("limit", String(filters.limit));

      const response = await axios.get<PaginatedResponse<Demo>>(
        `/api/demo?${params.toString()}`,
      );
      setDemos(response.data.data);
      setPagination({
        total: response.data.total,
        page: response.data.page,
        limit: response.data.limit,
        totalPages: response.data.totalPages,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao carregar demos");
    } finally {
      setLoading(false);
    }
  }, []);

  const getDemo = useCallback(async (id: string): Promise<Demo | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<Demo>(`/api/demo/${id}`);
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao carregar demo");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createDemo = useCallback(
    async (data: Partial<Demo>): Promise<Demo | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.post<Demo>("/api/demo", data);
        setDemos((prev) => [response.data, ...prev]);
        return response.data;
      } catch (err: any) {
        setError(err.response?.data?.message || "Erro ao criar demo");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const updateDemo = useCallback(
    async (id: string, data: Partial<Demo>): Promise<Demo | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.put<Demo>(`/api/demo/${id}`, data);
        setDemos((prev) => prev.map((d) => (d.id === id ? response.data : d)));
        return response.data;
      } catch (err: any) {
        setError(err.response?.data?.message || "Erro ao atualizar demo");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deleteDemo = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`/api/demo/${id}`);
      setDemos((prev) => prev.filter((d) => d.id !== id));
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao deletar demo");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const likeDemo = useCallback(async (id: string): Promise<boolean> => {
    try {
      await axios.post(`/api/demo/${id}/like`);
      setDemos((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, likesCount: d.likesCount + 1 } : d,
        ),
      );
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao curtir demo");
      return false;
    }
  }, []);

  const incrementViews = useCallback(async (id: string): Promise<boolean> => {
    try {
      await axios.post(`/api/demo/${id}/view`);
      setDemos((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, viewsCount: d.viewsCount + 1 } : d,
        ),
      );
      return true;
    } catch (err: any) {
      return false;
    }
  }, []);

  useEffect(() => {
    if (initialFilters) {
      fetchDemos(initialFilters);
    }
  }, []);

  return {
    demos,
    loading,
    error,
    pagination,
    fetchDemos,
    getDemo,
    createDemo,
    updateDemo,
    deleteDemo,
    likeDemo,
    incrementViews,
  };
};

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<Category[]>("/api/demo/categories");
      setCategories(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  }, []);

  const createCategory = useCallback(
    async (data: Partial<Category>): Promise<Category | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.post<Category>(
          "/api/demo/categories",
          data,
        );
        setCategories((prev) => [...prev, response.data]);
        return response.data;
      } catch (err: any) {
        setError(err.response?.data?.message || "Erro ao criar categoria");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const updateCategory = useCallback(
    async (id: string, data: Partial<Category>): Promise<Category | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.put<Category>(
          `/api/demo/categories/${id}`,
          data,
        );
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? response.data : c)),
        );
        return response.data;
      } catch (err: any) {
        setError(err.response?.data?.message || "Erro ao atualizar categoria");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`/api/demo/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao deletar categoria");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};

export const useTags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<Tag[]>("/api/demo/tags");
      setTags(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao carregar tags");
    } finally {
      setLoading(false);
    }
  }, []);

  const createTag = useCallback(
    async (data: Partial<Tag>): Promise<Tag | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.post<Tag>("/api/demo/tags", data);
        setTags((prev) => [...prev, response.data]);
        return response.data;
      } catch (err: any) {
        setError(err.response?.data?.message || "Erro ao criar tag");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const deleteTag = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`/api/demo/tags/${id}`);
      setTags((prev) => prev.filter((t) => t.id !== id));
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao deletar tag");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return {
    tags,
    loading,
    error,
    fetchTags,
    createTag,
    deleteTag,
  };
};

export const useComments = (demoId: string) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<Comment[]>(
        `/api/demo/${demoId}/comments`,
      );
      setComments(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao carregar comentários");
    } finally {
      setLoading(false);
    }
  }, [demoId]);

  const createComment = useCallback(
    async (content: string): Promise<Comment | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.post<Comment>("/api/demo/comments", {
          demoId,
          content,
        });
        setComments((prev) => [...prev, response.data]);
        return response.data;
      } catch (err: any) {
        setError(err.response?.data?.message || "Erro ao criar comentário");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [demoId],
  );

  const deleteComment = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await axios.delete(`/api/demo/comments/${id}`);
      setComments((prev) => prev.filter((c) => c.id !== id));
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Erro ao deletar comentário");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  return {
    comments,
    loading,
    error,
    fetchComments,
    createComment,
    deleteComment,
  };
};
