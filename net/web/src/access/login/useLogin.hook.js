import { useContext, useState, useEffect } from 'react';
import { AppContext } from 'context/AppContext';
import { useNavigate, useLocation } from "react-router-dom";

export function useLogin() {

  const [state, setState] = useState({
    username: '',
    password: '',
    available: false,
    disabled: true,
    busy: false,
  });

  const navigate = useNavigate();
  const { search } = useLocation();
  const app = useContext(AppContext);

  const updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  const actions = {
    setUsername: (username) => {
      updateState({ username });
    },
    setPassword: (password) => {
      updateState({ password });
    },
    isDisabled: () => {
      if (state.username === '' || state.password === '') {
        return true
      }
      return false
    },
    onSettings: () => {
      navigate('/admin');
    },
    onLogin: async () => {
      if (!state.busy && state.username !== '' && state.password !== '') {
        updateState({ busy: true })
        try {
          await app.actions.login(state.username, state.password)
        }
        catch (err) {
          console.log(err);
          updateState({ busy: false })
          throw new Error('login failed: check your username and password');
        }
        updateState({ busy: false })
      }
    },
    onCreate: () => {
      navigate('/create');
    },
  };

  useEffect(() => {
    if (app) {
      if (app.state) {
        if (app.state.access) {
          navigate('/session')
        }
        else {
          let params = new URLSearchParams(search);
          let token = params.get("access");
          if (token) {
            const access = async () => {
              updateState({ busy: true })
              try {
                await app.actions.access(token)
              }
              catch (err) {
                console.log(err);
              }
              updateState({ busy: false })
            }
            access();
          }
        }
      }
      if (app.actions && app.actions.available) {
        const count = async () => {
          try {
            const available = await app.actions.available()
            updateState({ available: available !== 0 })
          }
          catch(err) {
            console.log(err);
          }
        }
        count();
      }
    }
  }, [app, navigate, search])

  return { state, actions };
}

