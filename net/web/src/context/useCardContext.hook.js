import { useState, useRef, useContext } from 'react';
import { getContactChannels } from 'api/getContactChannels';
import { getContactChannelDetail } from 'api/getContactChannelDetail';
import { getContactChannelSummary } from 'api/getContactChannelSummary';
import { getContactProfile } from 'api/getContactProfile';
import { setCardProfile } from 'api/setCardProfile';
import { getCards } from 'api/getCards';
import { getCardImageUrl } from 'api/getCardImageUrl';
import { getCardProfile } from 'api/getCardProfile';
import { getCardDetail } from 'api/getCardDetail';
import { removeContactChannel } from 'api/removeContactChannel';
import { removeContactChannelTopic } from 'api/removeContactChannelTopic';
import { setContactChannelTopicSubject } from 'api/setContactChannelTopicSubject';
import { addContactChannelTopic } from 'api/addContactChannelTopic';
import { setCardConnecting, setCardConnected, setCardConfirmed } from 'api/setCardStatus';
import { getCardOpenMessage } from 'api/getCardOpenMessage';
import { setCardOpenMessage } from 'api/setCardOpenMessage';
import { getCardCloseMessage } from 'api/getCardCloseMessage';
import { setCardCloseMessage } from 'api/setCardCloseMessage';
import { getContactChannelTopics } from 'api/getContactChannelTopics';
import { getContactChannelTopic } from 'api/getContactChannelTopic';
import { getContactChannelTopicAssetUrl } from 'api/getContactChannelTopicAssetUrl';
import { addCard } from 'api/addCard';
import { removeCard } from 'api/removeCard';
import { UploadContext } from 'context/UploadContext';

export function useCardContext() {
  const [state, setState] = useState({
    init: false,
    cards: new Map(),
  });
  const upload = useContext(UploadContext);
  const access = useRef(null);
  const revision = useRef(null);
  const next = useRef(null);
  const cards = useRef(new Map());
  const resync = useRef([]);

  const updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  const updateCard = async (cardId) => {
    let card = cards.current.get(cardId);
    const { cardDetail, cardProfile } = card.data;

    if (cardDetail.status === 'connected' && card.error) {
      let message = await getContactProfile(cardProfile.node, cardProfile.guid, cardDetail.token);
      await setCardProfile(access.current, card.id, message);

      card.channels = new Map();
      await updateContactChannels(card.data.cardProfile.node, card.id, card.data.cardProfile.guid, card.data.cardDetail.token, null, null, card.channels);
      
      card.data.articles = new Map();
      await updateContactArticles(card.data.cardProfile.node, card.id, card.data.cardProfile.guid, card.data.cardDetail.token, null, null, card.data.articles);
        
      cards.current.set(card.id, { ...card, error: false });
    }
  }

  const updateCards = async () => {
    let delta = await getCards(access.current, revision.current);
    for (let card of delta) {
      if (card.data) {
        let cur = cards.current.get(card.id);
        if (cur == null) {
          cur = { id: card.id, data: { articles: new Map() }, error: false, notifiedProfile: null, channels: new Map() }
        }
        if (cur.data.detailRevision !== card.data.detailRevision) {
          if (card.data.cardDetail != null) {
            cur.data.cardDetail = card.data.cardDetail;
          }
          else {
            cur.data.cardDetail = await getCardDetail(access.current, card.id);
          }
          cur.data.detailRevision = card.data.detailRevision;
        }
        if (cur.data.profileRevision !== card.data.profileRevision) {
          if (card.data.cardProfile != null) {
            cur.data.cardProfile = card.data.cardProfile;
          }
          else {
            cur.data.cardProfile = await getCardProfile(access.current, card.id);
          }
          cur.data.profileRevision = card.data.profileRevision;
        }
        const { cardDetail, cardProfile } = cur.data;
        if (cardDetail.status === 'connected' && !cur.error) {
          try {
            if (cur.data.profileRevision !== card.data.notifiedProfile && cur.notifiedProfile !== card.data.notifiedProfile) {
              let message = await getContactProfile(cardProfile.node, cardProfile.guid, cardDetail.token);
              await setCardProfile(access.current, card.id, message);

              // update remote profile
              cur.notifiedProfile = card.data.notifiedProfile;
            }
            if (cur.data.notifiedView !== card.data.notifiedView) {
              // update remote articles and channels
              cur.data.articles = new Map();
              cur.channels = new Map();

              await updateContactChannels(cur.data.cardProfile.node, card.id, cur.data.cardProfile.guid, cur.data.cardDetail.token, cur.data.notifiedView, cur.data.notifiedChannel, cur.channels);
              await updateContactArticles(cur.data.cardProfile.node, card.id, cur.data.cardProfile.guid, cur.data.cardDetail.token, cur.data.notifiedView, cur.data.notifiedArticle, cur.data.articles);

              // update view
              cur.data.notifiedArticle = card.data.notifiedArticle;
              cur.data.notifiedChannel = card.data.notifiedChannel;
              cur.data.notifiedView = card.data.notifiedView;
            }
            if (cur.data.notifiedArticle !== card.data.notifiedArticle) {
              // update remote articles
              await updateContactArticles(cur.data.cardProfile.node, card.id, cur.data.cardProfile.guid, cur.data.cardDetail.token, cur.data.notifiedView, cur.data.notifiedArticle, cur.data.articles);
              cur.data.notifiedArticle = card.data.notifiedArticle;
            }
            if (cur.data.notifiedChannel !== card.data.notifiedChannel) {
              // update remote channels
              await updateContactChannels(cur.data.cardProfile.node, card.id, cur.data.cardProfile.guid, cur.data.cardDetail.token, cur.data.notifiedView, cur.data.notifiedChannel, cur.channels);
              cur.data.notifiedChannel = card.data.notifiedChannel;
            }
          }
          catch (err) {
            // contact update failed
            console.log(err);
            cur.channels = new Map();
            cur.articles = new Map();
            cur.revision = 0;
            cards.current.set(card.id, { ...cur, error: true });
            continue;
          }
        }
        else {
          cur.channels = new Map();
          cur.articles = new Map();
        }
        cur.revision = card.revision;
        cards.current.set(card.id, { ...cur });
      }
      else {
        cards.current.delete(card.id);
      }
    }
  }

  const updateContactChannels = async (node, cardId, guid, token, viewRevision, channelRevision, channelMap) => {
    let delta = await getContactChannels(node, guid + "." + token, viewRevision, channelRevision);
    for (let channel of delta) {
      if (channel.data) {
        let cur = channelMap.get(channel.id);
        if (cur == null) {
          cur = { guid, cardId, id: channel.id, data: { } }
        }
        if (cur.data.detailRevision !== channel.data.detailRevision) {
          if (channel.data.channelDetail != null) {
            cur.data.channelDetail = channel.data.channelDetail;
          }
          else {
            let detail = await getContactChannelDetail(node, guid + "." + token, channel.id);
            cur.data.channelDetail = detail;
          }
          cur.data.detailRevision = channel.data.detailRevision;
        }
        if (cur.data.topicRevision !== channel.data.topicRevision) {
          if (channel.data.channelSummary != null) {
            cur.data.channelSummary = channel.data.channelSummary;
          }
          else {
            let summary = await getContactChannelSummary(node, guid + "." + token, channel.id);
            cur.data.channelSummary = summary;
          }
          cur.data.topicRevision = channel.data.topicRevision;
        }
        cur.revision = channel.revision;
        channelMap.set(channel.id, { ...cur });
      }
      else {
        channelMap.delete(channel.id);
      }
    }
  }

  const updateContactArticles = async (node, cardId, guid, token, viewRevision, articleRevision, articleMap) => {
    console.log("update contact articles");
  }

  const setCards = async (rev) => {
    if (next.current == null) {
      if (rev == null) {
        rev = revision.curren;
      }
      next.current = rev;
      if (revision.current !== rev) {
        try {
          await updateCards();
        }
        catch(err) {
          console.log(err);
        }
        updateState({ init: true, cards: cards.current });
        revision.current = rev;
      }

      while (resync.current.length) {
        try {
          await updateCard(resync.current.shift());
          updateState({ cards: cards.current });
        }
        catch (err) {
          console.log(err);
        }
      } 
     
      let r = next.current;
      next.current = null;
      if (revision.current !== r) {
        setCards(r);
      }
    }
    else {
      if (rev != null) {
        next.current = rev;
      }
    }
  }

  const getCardByGuid = (guid) => {
    let card = null;
    cards.current.forEach((value, key, map) => {
      if(value?.data?.cardProfile?.guid === guid) {
        card = value;
      }
    });
    return card;
  }

  const actions = {
    setToken: (token) => {
      access.current = token;
    },
    clearToken: () => {
      access.current = null;
      cards.current = new Map();
      revision.current = null;
      setState({ init: false, cards: new Map() });
    }, 
    setRevision: async (rev) => {
      setCards(rev);
    },
    getCardByGuid: getCardByGuid,
    getCardProfileByGuid: (guid) => {
      let card = getCardByGuid(guid);
      if (card) {
        let { name, handle } = card.data.cardProfile;
        if (card.data.cardProfile.imageSet) {
          return { name, handle, imageUrl: getCardImageUrl(access.current, card.id, card.data.profileRevision) };
        }
        return { name, handle }
      }
      return {};
    },
    getImageUrl: (cardId) => {
      let card = cards.current.get(cardId);
      if (!card || !card.data.cardProfile.imageSet) {
        return null;
      }
      return getCardImageUrl(access.current, cardId, card.data.profileRevision)
    },
    getName: (cardId) => {
      let card = cards.current.get(cardId);
      if (!card) {
        return null;
      }
      return card.data.cardProfile.name;
    },
    removeChannel: async (cardId, channelId) => {
      let { cardProfile, cardDetail } = cards.current.get(cardId).data;
      let token = cardProfile.guid + '.' + cardDetail.token;
      let node = cardProfile.node;
      await removeContactChannel(node, token, channelId);
    },
    removeChannelTopic: async (cardId, channelId, topicId) => {
      let { cardProfile, cardDetail } = cards.current.get(cardId).data;
      let token = cardProfile.guid + '.' + cardDetail.token;
      let node = cardProfile.node;
      await removeContactChannelTopic(node, token, channelId, topicId);
      try {
        resync.current.push(cardId);
        await setCards(null);
      }
      catch (err) {
        console.log(err);
      }
    },
    setChannelTopicSubject: async (cardId, channelId, topicId, data) => {
      let { cardProfile, cardDetail } = cards.current.get(cardId).data;
      let token = cardProfile.guid + '.' + cardDetail.token;
      let node = cardProfile.node;
      await setContactChannelTopicSubject(node, token, channelId, topicId, data);
      try {
        resync.current.push(cardId);
        await setCards(null);
      }
      catch (err) {
        console.log(err);
      }
    },
    addChannelTopic: async (cardId, channelId, message, files) => {
      let { cardProfile, cardDetail } = cards.current.get(cardId).data;
      let token = cardProfile.guid + '.' + cardDetail.token;
      let node = cardProfile.node;
      if (files?.length) {
        const topicId = await addContactChannelTopic(node, token, channelId, null, null);
        upload.actions.addContactTopic(node, token, cardId, channelId, topicId, files, async (assets) => {
          message.assets = assets;
          await setContactChannelTopicSubject(node, token, channelId, topicId, message);
        }, async () => {
          try {
            await removeContactChannelTopic(node, token, channelId, topicId);
          }
          catch(err) {
            console.log(err);
          }
        });
      }
      else {
        await addContactChannelTopic(node, token, channelId, message, files);
      }
      try {
        resync.current.push(cardId);
        await setCards(null);
      }
      catch (err) {
        console.log(err);
      }
    },
    getChannel: (cardId, channelId) => {
      let card = cards.current.get(cardId);
      let channel = card.channels.get(channelId);
      return channel;
    },
    getChannelRevision: (cardId, channelId) => {
      let card = cards.current.get(cardId);
      let channel = card.channels.get(channelId);
      return channel?.revision;
    },
    getChannelTopics: async (cardId, channelId, revision, count, begin, end) => {
      let card = cards.current.get(cardId);
      let node = card.data.cardProfile.node;
      let token = card.data.cardProfile.guid + '.' + card.data.cardDetail.token;
      return await getContactChannelTopics(node, token, channelId, revision, count, begin, end);
    },
    getChannelTopic: async (cardId, channelId, topicId) => {
      let card = cards.current.get(cardId);
      let node = card.data.cardProfile.node;
      let token = card.data.cardProfile.guid + '.' + card.data.cardDetail.token;
      return await getContactChannelTopic(node, token, channelId, topicId);
    },
    addCard: async (message) => {
      return await addCard(access.current, message);
    },
    removeCard: async (cardId) => {
      return await removeCard(access.current, cardId);
    },
    setCardConnecting: async (cardId) => {
      return await setCardConnecting(access.current, cardId);
    },
    setCardConnected: async (cardId, token, rev) => {
      return await setCardConnected(access.current, cardId, token,
          rev.viewRevision, rev.articleRevision, rev.channelRevision, rev.profileRevision);
    },
    setCardConfirmed: async (cardId) => {
      return await setCardConfirmed(access.current, cardId);
    },
    getCardOpenMessage: async (cardId) => {
      return await getCardOpenMessage(access.current, cardId);
    },
    setCardOpenMessage: async (server, message) => {
      return await setCardOpenMessage(server, message);
    },
    getCardCloseMessage: async (cardId) => {
      return await getCardCloseMessage(access.current, cardId);
    },
    setCardCloseMessage: async (server, message) => {
      return await setCardCloseMessage(server, message);
    },
    getContactChannelTopicAssetUrl: (cardId, channelId, topicId, assetId) => {
      let card = cards.current.get(cardId);
      let node = card.data.cardProfile.node;
      let token = card.data.cardProfile.guid + "." + card.data.cardDetail.token;
      return getContactChannelTopicAssetUrl(node, token, channelId, topicId, assetId);
    },
    resync: async (cardId) => {
      resync.current.push(cardId);
      await setCards(null);
    }
  }

  return { state, actions }
}


