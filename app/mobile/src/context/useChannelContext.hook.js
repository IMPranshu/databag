import { useState, useRef, useContext } from 'react';
import { StoreContext } from 'context/StoreContext';
import { UploadContext } from 'context/UploadContext';
import { getChannels } from 'api/getChannels';
import { getChannelDetail } from 'api/getChannelDetail';
import { getChannelSummary } from 'api/getChannelSummary';
import { addChannel } from 'api/addChannel';
import { removeChannel } from 'api/removeChannel';
import { removeChannelTopic } from 'api/removeChannelTopic';
import { setChannelTopicSubject } from 'api/setChannelTopicSubject';
import { addChannelTopic } from 'api/addChannelTopic';
import { getChannelTopics } from 'api/getChannelTopics';
import { getChannelTopic } from 'api/getChannelTopic';
import { getChannelTopicAssetUrl } from 'api/getChannelTopicAssetUrl';
import { setChannelSubject } from 'api/setChannelSubject';
import { setChannelCard } from 'api/setChannelCard';
import { clearChannelCard } from 'api/clearChannelCard';
import { addFlag } from 'api/addFlag';

export function useChannelContext() {
  const [state, setState] = useState({
    channels: new Map(),
  });
  const store = useContext(StoreContext);
  const upload = useContext(UploadContext);

  const session = useRef(null);
  const curRevision = useRef(null);
  const setRevision = useRef(null);
  const syncing = useRef(false);
  const channels = useRef(new Map());

  const updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  const setChannel = (channelId, channel) => {
    let update = channels.current.get(channelId);
    if (!update) {
      update = { readRevision: 0 };
    }
    update.channelId = channel?.id;
    update.revision = channel?.revision;
    update.detail = channel?.data?.channelDetail;
    update.summary = channel?.data?.channelSummary;
    update.detailRevision = channel?.data?.detailRevision;
    update.topicRevision = channel?.data?.topicRevision;
    channels.current.set(channelId, update);
  }
  const setChannelDetail = (channelId, detail, revision) => {
    let channel = channels.current.get(channelId);
    if (channel) {
      channel.detail = detail;
      channel.detailRevision = revision;
      channels.current.set(channelId, channel);
    }
  }
  const setChannelSummary = (channelId, summary, revision) => {
    let channel = channels.current.get(channelId);
    if (channel) {
      channel.summary = summary;
      channel.topicRevision = revision;
      channels.current.set(channelId, channel);
    }
  }
  const setChannelRevision = (channelId, revision) => {
    let channel = channels.current.get(channelId);
    if (channel) {
      channel.revision = revision;
      channels.current.set(channelId, channel);
    }
  }
  const setChannelReadRevision = (channelId, revision) => {
    let channel = channels.current.get(channelId);
    if (channel) {
      channel.readRevision = revision;
      channels.current.set(channelId, channel);
    }
  }
  const setChannelSyncRevision = (channelId, revision) => {
    let channel = channels.current.get(channelId);
    if (channel) {
      channel.syncRevision = revision;
      channels.current.set(channelId, channel);
    }
  }
  const setChannelBlocked = (channelId, blocked) => {
    let channel = channels.current.get(channelId);
    if (channel) {
      channel.blocked = blocked;
      channels.current.set(channelId, channel);
    }
  }

  const sync = async () => {

    if (!syncing.current && setRevision.current !== curRevision.current) {
      syncing.current = true;

      try {
        const revision = curRevision.current;
        const { server, appToken, guid } = session.current;

        const delta = await getChannels(server, appToken, setRevision.current);
        for (let channel of delta) {
          if (channel.data) {
            if (channel.data.channelDetail && channel.data.channelSummary) {
              await store.actions.setChannelItem(guid, channel);
              setChannel(channel.id, channel);
            }
            else {
              const { detailRevision, topicRevision, channelDetail, channelSummary } = channel.data;
              const view = await store.actions.getChannelItemView(guid, channel.id);
              if (view == null) {
                let assembled = JSON.parse(JSON.stringify(channel));
                assembled.data.channelDetail = await getChannelDetail(server, appToken, channel.id);
                assembled.data.channelSummary = await getChannelSummary(server, appToken, channel.id);
                await store.actions.setChannelItem(guid, assembled);
                setChannel(assembled.id, assembled);
              }
              else {
                if (view.detailRevision != detailRevision) {
                  const detail = await getChannelDetail(server, appToken, channel.id);
                  await store.actions.setChannelItemDetail(guid, channel.id, detailRevision, detail);
                  setChannelDetail(channel.id, detail, detailRevision);
                }
                if (view.topicRevision != topicRevision) {
                  const summary = await getChannelSummary(server, appToken, channel.id);
                  await store.actions.setChannelItemSummary(guid, channel.id, topicRevision, summary);
                  setChannelSummary(channel.id, summary, topicRevision);
                }
                await store.actions.setChannelItemRevision(guid, channel.id, channel.revision);
                setChannelRevision(channel.id, channel.revision);
              }
            }
          }
          else {
            await store.actions.clearChannelItem(guid, channel.id);
            channels.current.delete(channel.id);
          }
        }

        setRevision.current = revision;
        await store.actions.setChannelRevision(guid, revision);
        updateState({ channels: channels.current });
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
      channels.current = new Map();
      const items = await store.actions.getChannelItems(guid);
      for(item of items) {
        channels.current.set(item.channelId, item);
      }
      const revision = await store.actions.getChannelRevision(guid);
      updateState({ channels: channels.current });
      setRevision.current = revision;
      curRevision.current = revision;
      session.current = access;
    },
    clearSession: () => {
      session.current = {};
      channels.current = new Map();
      updateState({ account: null, channels: channels.current });
    },
    setRevision: (rev) => {
      curRevision.current = rev;
      sync();
    },
    setReadRevision: async (channelId, rev) => {
      await store.actions.setChannelItemReadRevision(session.current.guid, channelId, rev);
      setChannelReadRevision(channelId, rev);
      updateState({ channels: channels.current }); 
    },
    setSyncRevision: async (channelId, revision) => {
      const { guid } = session.current;
      await store.actions.setChannelItemSyncRevision(guid, channelId, revision);
      setChannelSyncRevision(channelId, revision);
      updateState({ channels: channels.current }); 
    },
    setBlocked: async (channelId) => {
      const { guid } = session.current;
      await store.actions.setChannelItemBlocked(guid, channelId);
      setChannelBlocked(channelId, 1);
      updateState({ channels: channels.current }); 
    },
    clearBlocked: async (channelId) => {
      const { guid } = session.current;
      await store.actions.clearChannelItemBlocked(guid, channelId);
      setChannelBlocked(channelId, 0);
      updateState({ channels: channels.current }); 
    },
    setTopicBlocked: async (channelId, topicId) => {
      const { guid } = session.current;
      await store.actions.setChannelTopicBlocked(guid, channelId, topicId, true);
    },
    clearTopicBlocked: async (channelId, topicId) => {
      const { guid } = session.current;
      await store.actions.setChannelTopicBlocked(guid, channelId, topicId, false);
    },
    getTopicBlocked: async () => {
      const { guid } = session.current;
      return await store.actions.getChannelTopicBlocked(guid);
    },
    getTopicItems: async (channelId) => {
      const { guid } = session.current;
      return await store.actions.getChannelTopicItems(guid, channelId);
    },
    setTopicItem: async (channelId, topicId, topic) => {
      const { guid } = session.current;
      return await store.actions.setChannelTopicItem(guid, channelId, topicId, topic);
    },
    clearTopicItem: async (channelId, topicId) => {
      const { guid } = session.current;
      return await store.actions.clearChannelTopicItem(guid, channelId, topicId);
    },
    clearTopicItems: async (channelId) => {
      const { guid } = session.current;
      return await store.actions.clearChannelTopicItems(guid, channelId);
    },
    getTopic: async (channelId, topicId) => {
      const { server, appToken } = session.current;
      return await getChannelTopic(server, appToken, channelId, topicId);
    },
    getTopics: async (channelId, revision) => {
      const { server, appToken } = session.current;
      return await getChannelTopics(server, appToken, channelId, revision);
    },
    getTopicAssetUrl: (channelId, topicId, assetId) => {
      const { server, appToken } = session.current;
      return getChannelTopicAssetUrl(server, appToken, channelId, topicId, assetId);
    },
    addTopic: async (channelId, message, files) => {
      const { server, appToken } = session.current;
      if (files?.length > 0) {
        const topicId = await addChannelTopic(server, appToken, channelId, null, null);
        upload.actions.addTopic(server, appToken, channelId, topicId, files, async (assets) => {
          message.assets = assets;
          await setChannelTopicSubject(server, appToken, channelId, topicId, message);
        }, async () => {
          try {
            await removeChannelTopic(server, appToken, channelId, topicId);
          }
          catch (err) {
            console.log(err);
          }
        });
      }
      else {
        await addChannelTopic(server, appToken, channelId, message, []);
      }
    },
    setTopicSubject: async (channelId, topicId, data) => {
      const { server, appToken } = session.current;
      return await setChannelTopicSubject(server, appToken, channelId, topicId, data);
    },
    setSubject: async (channelId, data) => {
      const { server, appToken } = session.current;
      return await setChannelSubject(server, appToken, channelId, data);
    },
    remove: async (channelId) => {
      const { server, appToken } = session.current;
      return await removeChannel(server, appToken, channelId);
    },
    add: async (subject, cards) => {
      const { server, appToken } = session.current;
      return await addChannel(server, appToken, subject, cards);
    },
    removeTopic: async (channelId, topicId) => {
      const { server, appToken } = session.current;
      return await removeChannelTopic(server, appToken, channelId, topicId);
    },
    addReport: async (channelId) => {
      const { server, guid } = session.current;
      return await addFlag(server, guid, channelId);
    },
    addTopicReport: async (channelId, topicId) => {
      const { server, guid } = session.current;
      return await addFlag(server, guid, channelId, topicId);
    },
    setCard: async (channelId, cardId) => {
      const { server, appToken } = session.current;
      return await setChannelCard(server, appToken, channelId, cardId);
    },
    clearCard: async (channelId, cardId) => {
      const { server, appToken } = session.current;
      return await clearChannelCard(server, appToken, channelId, cardId);
    },
  }

  return { state, actions }
}

