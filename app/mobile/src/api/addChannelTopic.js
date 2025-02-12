import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function addChannelTopic(server, token, channelId, message, assets ): string {

  if (message == null && (assets == null || assets.length === 0)) {
    let topic = await fetchWithTimeout(`https://${server}/content/channels/${channelId}/topics?agent=${token}`,
      { method: 'POST', body: JSON.stringify({}) });
    checkResponse(topic);
    let slot = await topic.json();
    return slot.id;
  }  
  else if (assets == null || assets.length === 0) {
    let subject = { data: JSON.stringify(message, (key, value) => {
      if (value !== null) return value
    }), datatype: 'superbasictopic' };
    
    let topic = await fetchWithTimeout(`https://${server}/content/channels/${channelId}/topics?agent=${token}&confirm=true`,
      { method: 'POST', body: JSON.stringify(subject) });
    checkResponse(topic);
    let slot = await topic.json();
    return slot.id;
  }
  else {
   
    let topic = await fetchWithTimeout(`https://${server}/content/channels/${channelId}/topics?agent=${token}`,
      { method: 'POST', body: JSON.stringify({}) });
    checkResponse(topic);
    let slot = await topic.json();

    // add each asset
    message.assets = [];
    for (let asset of assets) {
      if (asset.image) {
        const formData = new FormData();
        formData.append('asset', asset.image);
        let transform = encodeURIComponent(JSON.stringify(["ithumb;photo", "icopy;photo"]));
        let topicAsset = await fetch(`https://${server}/content/channels/${channelId}/topics/${slot.id}/assets?transforms=${transform}&agent=${token}`, { method: 'POST', body: formData });
        checkResponse(topicAsset);
        let assetEntry = await topicAsset.json();
        message.assets.push({
          image: {
            thumb: assetEntry.find(item => item.transform === 'ithumb;photo').assetId,
            full: assetEntry.find(item => item.transform === 'icopy;photo').assetId,
          }
        });
      }
      else if (asset.video) {
        const formData = new FormData();
        formData.append('asset', asset.video);
        let thumb = 'vthumb;video;' + asset.position;
        let transform = encodeURIComponent(JSON.stringify(["vlq;video", "vhd;video", thumb]));
        let topicAsset = await fetch(`https://${server}/content/channels/${channelId}/topics/${slot.id}/assets?transforms=${transform}&agent=${token}`, { method: 'POST', body: formData });
        checkResponse(topicAsset);
        let assetEntry = await topicAsset.json();
        message.assets.push({
          video: {
            thumb: assetEntry.find(item => item.transform === thumb).assetId,
            lq: assetEntry.find(item => item.transform === 'vlq;video').assetId,
            hd: assetEntry.find(item => item.transform === 'vhd;video').assetId,
          }
        });
      }
      else if (asset.audio) {
        const formData = new FormData();
        formData.append('asset', asset.audio);
        let transform = encodeURIComponent(JSON.stringify(["acopy;audio"]));
        let topicAsset = await fetch(`https://${server}/content/channels/${channelId}/topics/${slot.id}/assets?transforms=${transform}&agent=${token}`, { method: 'POST', body: formData });
        checkResponse(topicAsset);
        let assetEntry = await topicAsset.json();
        message.assets.push({
          audio: {
            label: asset.label,
            full: assetEntry.find(item => item.transform === 'acopy;audio').assetId,
          }
        });
      }
    }

    let subject = { data: JSON.stringify(message, (key, value) => {
      if (value !== null) return value
    }), datatype: 'superbasictopic' };
 
    let unconfirmed = await fetchWithTimeout(`https://${server}/content/channels/${channelId}/topics/${slot.id}/subject?agent=${token}`, 
      { method: 'PUT', body: JSON.stringify(subject) });
    checkResponse(unconfirmed);

    let confirmed = await fetchWithTimeout(`https://${server}/content/channels/${channelId}/topics/${slot.id}/confirmed?agent=${token}`,
      { method: 'PUT', body: JSON.stringify('confirmed') });
    checkResponse(confirmed);
    return slot.id;
  }
}

