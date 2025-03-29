import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { createActor } from 'declarations/backend';
import { canisterId } from 'declarations/backend/index.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [state, setState] = useState({
    actor: undefined,
    authClient: undefined,
    isAuthenticated: false,
    identity: undefined,
    principal: null
  });

  useEffect(() => {
    const initAuth = async () => {
      const authClient = await AuthClient.create();
      const identity = authClient.getIdentity();
      const actor = createActor(canisterId, {
        agentOptions: {
          identity
        }
      });
      const isAuthenticated = await authClient.isAuthenticated();

      setState({
        actor,
        authClient,
        isAuthenticated,
        identity,
        principal: isAuthenticated ? await fetchPrincipal(actor) : null
      });
    };

    initAuth();
  }, []);

  const fetchPrincipal = async (actor) => {
    try {
      const result = await actor.whoami();
      return result.toString();
    } catch (error) {
      console.error("Error fetching principal:", error);
      return null;
    }
  };

  const login = async () => {
    if (state.authClient) {
      await state.authClient.login({
        identityProvider:
          process.env.DFX_NETWORK === 'ic'
            ? 'https://identity.ic0.app' // Mainnet
            : 'http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943', // Local
        onSuccess: async () => {
          const identity = state.authClient.getIdentity();
          const actor = createActor(canisterId, {
            agentOptions: {
              identity
            }
          });
          const principal = await fetchPrincipal(actor);
          
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            identity,
            actor,
            principal
          }));
        },
      });
    }
  };

  const logout = async () => {
    if (state.authClient) {
      await state.authClient.logout();
      
      // Re-create actor with anonymous identity
      const authClient = state.authClient;
      const identity = authClient.getIdentity();
      const actor = createActor(canisterId, {
        agentOptions: {
          identity
        }
      });
      
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        identity,
        actor,
        principal: null
      }));
    }
  };

  const whoami = async () => {
    if (state.actor) {
      try {
        const result = await state.actor.whoami();
        const principal = result.toString();
        setState(prev => ({
          ...prev,
          principal
        }));
        return principal;
      } catch (error) {
        console.error("Error fetching principal:", error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, whoami }}>
      {children}
    </AuthContext.Provider>
  );
};