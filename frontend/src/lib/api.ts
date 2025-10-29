// import axios from 'axios';

// const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// export const api = axios.create({
//   baseURL: API_URL,
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });

// // Request interceptor to add token
// api.interceptors.request.use(
//   (config) => {
//     const token = localStorage.getItem('token');
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => {
//     return Promise.reject(error);
//   }
// );

// // Response interceptor for error handling
// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error.response?.status === 401) {
//       localStorage.removeItem('token');
//       localStorage.removeItem('user');
//       window.location.href = '/login';
//     }
//     return Promise.reject(error);
//   }
// );

// export interface User {
//   id: number;
//   username: string;
//   email: string;
//   created_at: string;
// }

// export interface PollOption {
//   id: number;
//   text: string;
//   position: number;
//   vote_count: number;
// }

// export interface Poll {
//   id: number;
//   title: string;
//   description: string | null;
//   creator_id: number;
//   creator_username: string;
//   created_at: string;
//   is_active: boolean;
//   options: PollOption[];
//   total_votes: number;
//   total_likes: number;
//   user_voted: boolean;
//   user_liked: boolean;
//   user_vote_option_id: number | null;
// }

// export interface PollListResponse {
//   polls: Poll[];
//   total: number;
//   page: number;
//   page_size: number;
//   total_pages: number;
// }

// // Auth API
// export const authAPI = {
//   register: async (username: string, email: string, password: string) => {
//     const response = await api.post('/api/auth/register', {
//       username,
//       email,
//       password,
//     });
//     return response.data;
//   },

//   login: async (username: string, password: string) => {
//     const response = await api.post('/api/auth/login', {
//       username,
//       password,
//     });
//     console.log(response.data);
//     return response.data;
//   },

//   getMe: async () => {
//     const response = await api.get('/api/auth/me');
//     return response.data;
//   },
// };

// // Poll API
// export const pollAPI = {
//   createPoll: async (title: string, description: string | null, options: string[]) => {
//     const response = await api.post('/api/polls', {
//       title,
//       description,
//       options: options.map((text) => ({ text })),
//     });
//     return response.data;
//   },

// //   getPolls: async (page: number = 1, page_size: number = 20) => {
// //     const response = await api.get<PollListResponse>('/api/polls', {
// //       params: { page, page_size },
// //     });
// //     return response.data;
// //   },

//   getPolls: async (page: number = 1, pageSize: number = 20, creatorId?: number): Promise<PollListResponse> => {
//     const params: any = { page, page_size: pageSize };
//     if (creatorId) {
//       params.creator_id = creatorId;
//     }
//     const response = await api.get('/api/polls', { params });
//     return response.data;
//   },

//   getPoll: async (pollId: number) => {
//     const response = await api.get<Poll>(`/api/polls/${pollId}`);
//     return response.data;
//   },

//   updatePoll: async (
//     pollId: number,
//     updates: { title?: string; description?: string | null; is_active?: boolean }
//   ) => {
//     const response = await api.put(`/api/polls/${pollId}`, updates);
//     return response.data;
//   },

//   deletePoll: async (pollId: number) => {
//     await api.delete(`/api/polls/${pollId}`);
//   },

//   vote: async (pollId: number, optionId: number) => {
//     const response = await api.post(`/api/polls/${pollId}/vote`, {
//       option_id: optionId,
//     });
//     return response.data;
//   },

//   toggleLike: async (pollId: number) => {
//     const response = await api.post(`/api/polls/${pollId}/like`);
//     return response.data;
//   },
// };


import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface PollOption {
  id: number;
  text: string;
  position: number;
  vote_count: number;
}

export interface Poll {
  id: number;
  title: string;
  description: string | null;
  creator_id: number;
  creator_username: string;
  created_at: string;
  is_active: boolean;
  options: PollOption[];
  total_votes: number;
  total_likes: number;
  user_voted: boolean;
  user_liked: boolean;
  user_vote_option_id: number | null;
}

export interface PollListResponse {
  polls: Poll[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Auth API
export const authAPI = {
  register: async (username: string, email: string, password: string) => {
    const response = await api.post('/api/auth/register', {
      username,
      email,
      password,
    });
    return response.data;
  },

  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', {
      username,
      password,
    });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },
};

// Poll API
export const pollAPI = {
  createPoll: async (title: string, description: string | null, options: string[]) => {
    const response = await api.post('/api/polls', {
      title,
      description,
      options: options.map((text) => ({ text })),
    });
    return response.data;
  },

  getPolls: async (page: number = 1, pageSize: number = 20, creatorId?: number): Promise<PollListResponse> => {
    const params: any = { page, page_size: pageSize };
    if (creatorId) {
      params.creator_id = creatorId;
    }
    const response = await api.get('/api/polls', { params });
    console.log("Fetched polls:", response.data);
    return response.data;
  },

  getPoll: async (pollId: number) => {
    const response = await api.get<Poll>(`/api/polls/${pollId}`);
    return response.data;
  },

  updatePoll: async (
    pollId: number,
    updates: { title?: string; description?: string | null; is_active?: boolean }
  ) => {
    const response = await api.put(`/api/polls/${pollId}`, updates);
    return response.data;
  },

  deletePoll: async (pollId: number) => {
    await api.delete(`/api/polls/${pollId}`);
  },

  vote: async (pollId: number, optionId: number) => {
    const response = await api.post(`/api/polls/${pollId}/vote`, {
      option_id: optionId,
    });
    return response.data;
  },

  toggleLike: async (pollId: number) => {
    const response = await api.post(`/api/polls/${pollId}/like`);
    return response.data;
  },
};