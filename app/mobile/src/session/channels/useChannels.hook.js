import { useState, useEffect, useRef, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { CardContext } from 'context/CardContext';
import { ChannelContext } from 'context/ChannelContext';
import { ProfileContext } from 'context/ProfileContext';
import { AppContext } from 'context/AppContext';
import config from 'constants/Config';

export function useChannels() {

  const [state, setState] = useState({
    topic: null,
    channels: [],
    tabbed: null,
    filter: null,
    adding: false,
    connected: [],
    addSubject: null,
    addMembers: [],
  });

  const items = useRef([]);
  const channel = useContext(ChannelContext);
  const card = useContext(CardContext);
  const profile = useContext(ProfileContext);
  const app = useContext(AppContext);
  const dimensions = useWindowDimensions();

  const updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    const contacts = Array.from(card.state.cards.values());
    const connected = contacts.filter(contact => {
      return contact.detail.status === 'connected'
    });
    const sorted = connected.sort((a, b) => {
      const aName = a?.profile?.name;
      const bName = b?.profile?.name;
      if (aName === bName) {
        return 0;
      }
      if (!aName || (aName < bName)) {
        return -1;
      }
      return 1;
    });
    updateState({ connected: sorted });
  }, [card]);

  useEffect(() => {
    if (dimensions.width > config.tabbedWidth) {
      updateState({ tabbed: false });
    }
    else {
      updateState({ tabbed: true });
    }
  }, [dimensions]);

  const getCard = (guid) => {
    let contact = null
    card.state.cards.forEach((card, cardId, map) => {
      if (card?.profile?.guid === guid) {
        contact = card;
      }
    });
    return contact;
  }

  const setChannelEntry = (item) => {

    let updated = false;
    const login = app.state.loginTimestamp;
    const { created, guid } = item?.summary?.lastTopic;
    if (created && login && login < created) {
      if (!item.readRevision || item.readRevision < item.revision) {
        if (profile.state.profile.guid != guid) {
          updated = true;
        }
      }
    }

    let contacts = [];
    if (item.cardId) {
      contacts.push(card.state.cards.get(item.cardId));
    }
    if (item?.detail?.members) {
      
      item.detail.members.forEach(guid => {
        const profileGuid = profile.state.profile.guid;
        if (profileGuid !== guid) { 
          contacts.push(getCard(guid));
        }
      })
    }

    let logo = null;
    if (contacts.length === 0) {
      logo = 'solution';
    }
    else if (contacts.length === 1) {
      if (contacts[0]?.profile?.imageSet) {
        logo = card.actions.getCardLogo(contacts[0].cardId, contacts[0].profileRevision);
      }
      else {
        logo = 'avatar';
      }
    }
    else {
      logo = 'appstore';
    }

    let subject = null;
    if (item?.detail?.data) {
      try {
        subject = JSON.parse(item?.detail?.data).subject;
      }
      catch (err) {
        console.log(err);
      }
    }
    if (!subject) {
      if (contacts.length) {
        let names = [];
        for (let contact of contacts) {
          if (contact?.profile?.name) {
            names.push(contact.profile.name);
          }
          else if (contact?.profile?.handle) {
            names.push(contact?.profile?.handle);
          }
        }
        subject = names.join(', ');
      }
      else {
        subject = "Notes";
      }
    }

    let message;
    if (item?.summary?.lastTopic?.dataType === 'superbasictopic') {
      try {
        message = JSON.parse(item.summary.lastTopic.data).text;
      }
      catch (err) {
        console.log(err);
      }
    }

    return { cardId: item.cardId, channelId: item.channelId, contacts, logo, subject, message, updated, revision: item.revision, timestamp: created, blocked: item.blocked === 1 };
  }

  useEffect(() => {
    let merged = [];
    card.state.cards.forEach((card, cardId, map) => {
      if (!card.blocked) {
        merged.push(...Array.from(card.channels.values()));
      }
    });
    merged.push(...Array.from(channel.state.channels.values()));
    
    const items = merged.map(setChannelEntry);

    const filtered  = items.filter(item => {
      if (item.blocked === true) {
        return false;
      }

      if (!state.filter) {
        return true;
      }
      const lower = state.filter.toLowerCase();
      if (item.subject) {
        if (item.subject.toLowerCase().includes(lower)) {
          return true;
        }
      }
      return false;
    });

    const sorted = filtered.sort((a, b) => {
      const aCreated = a?.timestamp;
      const bCreated = b?.timestamp;
      if (aCreated === bCreated) {
        return 0;
      }
      if (!aCreated || aCreated < bCreated) {
        return 1;
      }
      return -1;
    });

    updateState({ channels: sorted });
  }, [channel, card, state.filter]);

  const actions = {
    setTopic: (topic) => {
      updateState({ topic });
    },
    setFilter: (filter) => {
      updateState({ filter });
    },
    setAddSubject: (addSubject) => {
      updateState({ addSubject });
    },
    setAddMember: (cardId) => {
      updateState({ addMembers: [ ...state.addMembers, cardId ] });
    },
    clearAddMember: (cardId) => {
      updateState({ addMembers: state.addMembers.filter(item => item !== cardId) });
    },
    showAdding: () => {
      updateState({ adding: true, addSubject: null, addMembers: [] });
    },
    hideAdding: () => {
      updateState({ adding: false });
    },
    addTopic: async () => {
      return await channel.actions.add(state.addSubject, state.addMembers);
    }
  };

  return { state, actions };
}

