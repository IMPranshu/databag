import { useContext, useState, useEffect, useRef } from 'react';
import { ConversationContext } from 'context/ConversationContext';
import { ProfileContext } from 'context/ProfileContext';
import { CardContext } from 'context/CardContext';

export function useTopicItem(topic) {

  const [state, setState] = useState({
    init: false,
    name: null,
    handle: null,
    imageUrl: null,
    message: null,
    created: null,
    confirmed: false,
    ready: false,
    error: false,
    owner: false,
    assets: [],
    topicId: null,
    editing: false,
    busy: false,
    textColor: '#444444',
    textSize: 14,
  });

  const profile = useContext(ProfileContext);
  const card = useContext(CardContext);
  const conversation = useContext(ConversationContext);
  const editMessage = useRef(null);

  const updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    let owner = false;
    if (profile.state.profile.guid === topic?.data?.topicDetail.guid) {
      owner = true;
    }

    let textColor = '#444444';
    let textSize = 14;

    if (!topic?.data) {
      console.log("invalid topic:", topic);
      return;
    }

    const { status, transform, data } = topic.data.topicDetail;
    let message;
    let ready = false;
    let error = false;
    let confirmed = false;
    let assets = [];
    if (status === 'confirmed') {
      confirmed = true;
      try {
        message = JSON.parse(data);
        if (message.textColor != null) {
          textColor = message.textColor;
        }
        if (message.textSize != null) {
          textSize = message.textSize;
        }
        if (message.assets) {
          assets = message.assets;
          delete message.assets;
        }
        if (transform === 'complete') {
          ready = true;
        }
        if (transform === 'error') {
          error = true;
        }
      }
      catch(err) {
        console.log(err);
      }
    }

    if (profile.state.init && card.state.init && conversation.state.init) {
      const { guid, created } = topic.data.topicDetail;

      let createdStr;
      const date = new Date(created * 1000);
      const now = new Date();
      const offset = now.getTime() - date.getTime();
      if(offset < 86400000) {
        createdStr = date.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'});
      }
      else if (offset < 31449600000) {
        createdStr = date.toLocaleDateString("en-US", {day: 'numeric', month:'numeric'});
      }
      else {
        createdStr = date.toLocaleDateString("en-US");
      }

      if (profile.state.profile.guid === guid) {
        const { name, handle, imageUrl } = profile.actions.getProfile();
        updateState({ name, handle, imageUrl, status, message, transform, assets, confirmed, error, ready, created: createdStr, owner, textColor, textSize, topicId: topic.id, init: true });
      }
      else {
        const { name, handle, imageUrl } = card.actions.getCardProfileByGuid(guid);
        updateState({ name, handle, imageUrl, status, message, transform, assets, confirmed, error, ready, created: createdStr, owner, textColor, textSize, topicId: topic.id, init: true });
      }
    }
  }, [profile, card, conversation, topic]);

  const actions = {
    getAssetUrl: (assetId, topicId) => {
      return conversation.actions.getAssetUrl(state.topicId, assetId);
    },
    removeTopic: async () => {
      return await conversation.actions.removeTopic(topic.id);
    },
    setEditing: (editing) => {
      editMessage.current = state.message?.text;
      updateState({ editing });
    },
    setEdit: (edit) => {
      editMessage.current = edit;
    },
    setMessage: async () => {
      if (!state.busy) {
        updateState({ busy: true });
        try {
          await conversation.actions.setTopicSubject(topic.id,
              { ...state.message, text: editMessage.current, assets: state.assets });
          updateState({ editing: false });
        }
        catch (err) {
          window.alert(err);
        }
        updateState({ busy: false });
      }
    },
  };

  return { state, actions };
}
