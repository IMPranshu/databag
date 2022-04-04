import { useEffect, useState, useRef } from 'react';
import { getCards, getCardImageUrl, getCardProfile, getCardDetail, getListingImageUrl, getListing, setProfileImage, setProfileData, getProfileImageUrl, getAccountStatus, setAccountSearchable, getProfile, getGroups, getAvailable, getUsername, setLogin, createAccount } from './fetchUtil';

async function updateAccount(token, updateData) {
  let status = await getAccountStatus(token);
  updateData({ status: status });
}

async function updateProfile(token, updateData) {
  let profile = await getProfile(token);
  updateData({ profile: profile })
}

async function updateGroups(token, revision, groupMap, updateData) {
  let groups = await getGroups(token, revision);
  for (let group of groups) {
    if (group.data) {
      groupMap.set(group.id, group);
    }
    else {
      groupMap.delete(group.id);
    }
  }
  updateData({ groups: Array.from(groupMap.values()) });
}

async function updateCards(token, revision, cardMap, updateData) {
  let cards = await getCards(token, revision);
  for (let card of cards) {
    if (card.data) {
      let cur = cardMap.get(card.id);
      if (cur == null) {
        cur = { id: card.id, data: {} }
      }
      if (cur.data.detailRevision != card.data.detailRevision) {
        if (card.data.cardDetail != null) {
          cur.data.cardDetail = card.data.cardDetail;
        }
        else {
          cur.data.cardDetail = await getCardDetail(token, card.id);
        }
        cur.data.detailRevision = card.data.detailRevision;
      }
      if (cur.data.profileRevision != card.data.profileRevision) {
        if (cur.data.cardProfile != null) {
          cur.data.cardProfile = card.data.cardProfile;
        }
        else {
          cur.data.cardProfile = await getCardProfile(token, card.id);
        }
        cur.data.profileRevision = card.data.profileRevision;
      }
      if (cur.data.notifiedProfile != card.data.notifiedProfile) {
        // update remote profile
        cur.data.notifiedProfile = card.data.notifiedProfile;
      }
      if (cur.data.notifiedView != card.data.notifiedView) {
        // update remote articles and channels
        cur.data.notifiedArticle = card.data.notifiedArticle;
        cur.data.notifiedChannel = card.data.notifiedChannel;
        cur.data.notifiedView = card.data.notifiedView;
      }
      if (cur.data.notifiedArticle != card.data.notifiedArticle) {
        // update remote articles
        cur.data.notifiedArticle = card.data.notifiedArticle;
      }
      if (cur.data.notifiedChannel != card.data.notifiedChannel) {
        // update remote channels
        cur.data.notifiedChannel = card.data.notifiedChannel;
      }
      cur.revision = card.revision;
      cardMap.set(card.id, cur);
    }
    else {
      cardMap.delete(card.id);
    }
  }
  updateData({ cards: Array.from(cardMap.values()) });
}

async function appCreate(username, password, updateState, setWebsocket) {
  await createAccount(username, password);
  let access = await setLogin(username, password)
  updateState({ token: access, access: 'user' });
  setWebsocket(access)
  localStorage.setItem("session", JSON.stringify({ token: access, access: 'user' }));
} 

async function appLogin(username, password, updateState, setWebsocket) {
  let access = await setLogin(username, password)
  updateState({ token: access, access: 'user' });
  setWebsocket(access)
  localStorage.setItem("session", JSON.stringify({ token: access, access: 'user' }));
}

function appLogout(updateState, clearWebsocket) {
  updateState({ token: null, access: null });
  clearWebsocket()
  localStorage.removeItem("session");
}



export function useAppContext() {
  const [state, setState] = useState(null);

  const groupRevision = useRef(null);
  const accountRevision = useRef(null);
  const profileRevision = useRef(null);
  const cardRevision = useRef(null);

  const cards = useRef(new Map());
  const groups = useRef(new Map());
  const delay = useRef(2);

  const ws = useRef(null);
  const revision = useRef(null);
  const updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }
  const updateData = (value) => {
    setState((s) => {
      let data = { ...s.Data, ...value }
      return { ...s, Data: data }
    })
  }

  const getCard = (guid) => {
    let card = null;
    cards.current.forEach((value, key, map) => {
      if(value?.data?.cardProfile?.guid == guid) {
        card = value
      }
    });
    return card;
  }

  const resetData = () => {
    revision.current = null;
    profileRevision.current = null;
    groupRevision.current = null;
    cardRevision.current = null;
    cards.current = new Map();
    groups.current = new Map();
    setState({});
  }

  const userActions = {
    logout: () => {
      appLogout(updateState, clearWebsocket);
      resetData();
    },
    setProfileData: async (name, location, description) => {
      await setProfileData(state.token, name, location, description);
    },
    setProfileImage: async (image) => {
      await setProfileImage(state.token, image);
    },
    setAccountSearchable: async (flag) => {
      await setAccountSearchable(state.token, flag);
    },
    profileImageUrl: () => getProfileImageUrl(state.token, state.Data?.profile?.revision),
    getRegistry: async (node) => getListing(node),
    getRegistryImageUrl: (server, guid, revision) => getListingImageUrl(server, guid, revision),
    getCardImageUrl: (cardId, revision) => getCardImageUrl(state.token, cardId, revision),
    getCard: getCard,
  }

  const adminActions = {
    logout: () => {
      appLogout(updateState, clearWebsocket);
      resetData();
    }
  }

  const accessActions = {
    login: async (username, password) => {
      await appLogin(username, password, updateState, setWebsocket)
    },
    create: async (username, password) => {
      await appCreate(username, password, updateState, setWebsocket)
    },
    username: getUsername,
    available: getAvailable,
  }

  const processRevision = async (token) => {
    while(revision.current != null) {
      let rev = revision.current;

      // update profile if revision changed
      if (rev.profile != profileRevision.current) {
        await updateProfile(token, updateData) 
        profileRevision.current = rev.profile
      }

      // update group if revision changed
      if (rev.group != groupRevision.current) {
        await updateGroups(token, groupRevision.current, groups.current, updateData);
        groupRevision.current = rev.group
      }

      // update card status if revision changed
      if (rev.card != cardRevision.current) {
        await updateCards(token, cardRevision.current, cards.current, updateData);
        cardRevision.current = rev.card
      }

      // update account status if revision changed
      if (rev.account != accountRevision.current) {
        await updateAccount(token, updateData)
        accountRevision.current = rev.account
      }

      // check if new revision was received during processing
      if (rev == revision.current) {
        revision.current = null
      }
    }
  }

  const setWebsocket = (token) => {
    ws.current = new WebSocket("wss://" + window.location.host + "/status");
    ws.current.onmessage = (ev) => {
      if (revision.current != null) {
        revision.current = JSON.parse(ev.data);
      }
      else {
        revision.current = JSON.parse(ev.data);
        processRevision(token)
      }
    }
    ws.current.onclose = (e) => {
      console.log(e)
      setTimeout(() => {
        if (ws.current != null) {
          ws.current.onmessage = () => {}
          ws.current.onclose = () => {}
          ws.current.onopen = () => {}
          ws.current.onerror = () => {}
          setWebsocket(token);
          delay.current += 1;
        }
      }, delay.current * 1000)
    }
    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ AppToken: token }))
    }
    ws.current.error = (e) => {
      console.log(e)
    }
  }
 
  const clearWebsocket = ()  => {
    ws.current.onclose = () => {}
    ws.current.close()
    ws.current = null
  }

  useEffect(() => {
    const storage = localStorage.getItem('session');
    if (storage != null) {
      try {
        const session = JSON.parse(storage)
        if (session?.access === 'admin') {
          setState({ token: session.token, access: session.access })
        } else if (session?.access === 'user') {
          setState({ token: session.token, access: session.access })
          setWebsocket(session.token);   
        } else {
          setState({})
        }
      }
      catch(err) {
        console.log(err)
        setState({})
      }
    } else {
      setState({})
    }
  }, []);

  if (!state) {
    return {}
  }
  if (state.access === 'user') {
    return { state, actions: userActions }
  }
  if (state.access === 'admin') {
    return { state, actions: adminActions }
  }
  return { actions: accessActions }
}


