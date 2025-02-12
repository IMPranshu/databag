import { useState, useRef, useContext } from 'react';
import { StoreContext } from 'context/StoreContext';
import { setAccountSearchable } from 'api/setAccountSearchable';
import { getAccountStatus } from 'api/getAccountStatus';
import { setAccountLogin } from 'api/setAccountLogin';

export function useAccountContext() {
  const [state, setState] = useState({
    status: {},
  });
  const store = useContext(StoreContext);

  const session = useRef(null);
  const curRevision = useRef(null);
  const setRevision = useRef(null);
  const syncing = useRef(false);

  const updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  const sync = async () => {
    if (!syncing.current && setRevision.current !== curRevision.current) {
      syncing.current = true;

      try {
        const revision = curRevision.current;
        const { server, appToken, guid } = session.current;
        const status = await getAccountStatus(server, appToken);
        await store.actions.setAccountStatus(guid, status);
        await store.actions.setAccountRevision(guid, revision);
        updateState({ status });
        setRevision.current = revision;
      }
      catch(err) {
        console.log(err);
        syncing.current = false;
        return;
      }

      syncing.current = false;
      sync();
    }
  };

  const actions = {
    setSession: async (access) => {
      const { guid, server, appToken } = access;
      const status = await store.actions.getAccountStatus(guid);
      const revision = await store.actions.getAccountRevision(guid);
      updateState({ status });
      setRevision.current = revision;
      curRevision.current = revision;
      session.current = access;
    },
    clearSession: () => {
      session.current = {};
      updateState({ account: null });
    },
    setRevision: (rev) => {
      curRevision.current = rev;
      sync();
    },
    setSearchable: async (flag) => {
      const { server, appToken } = session.current;
      await setAccountSearchable(server, appToken, flag);
    },
    setLogin: async (username, password) => {
      const { server, appToken } = session.current;
      await setAccountLogin(server, appToken, username, password);
    },
  }

  return { state, actions }
}


