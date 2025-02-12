import { Image, View, Text, TouchableOpacity } from 'react-native';
import { useRef } from 'react';
import Colors from 'constants/Colors';
import { Video, AVPlaybackStatus } from 'expo-av';
import { useAudioAsset } from './useAudioAsset.hook';
import GestureRecognizer from 'react-native-swipe-gestures';
import { styles } from './AudioAsset.styled';
import Icons from '@expo/vector-icons/MaterialCommunityIcons';
import audio from 'images/audio.png';

export function AudioAsset({ topicId, asset, dismiss }) {

  const { state, actions } = useAudioAsset(topicId, asset);

  const player = useRef(null);

  return (
    <View style={styles.container}>
      <Image source={audio} style={{ width: state.width, height: state.height }} resizeMode={'contain'} />
      <Text style={styles.label}>{ asset.label }</Text>
      { !state.playing && state.loaded && (
        <TouchableOpacity style={styles.control} onPress={actions.play}>
          <Icons name="play-circle-outline" size={92} color={Colors.text} />
        </TouchableOpacity>
      )}
      { state.playing && state.loaded && (
        <TouchableOpacity style={styles.control} onPress={actions.pause}>
          <Icons name="pause-circle-outline" size={92} color={Colors.text} />
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.close} onPress={dismiss}>
        <Icons name="window-close" size={32} color={Colors.text} />
      </TouchableOpacity>
      <Video ref={player} source={{ uri: state.url }} isLooping={true}
        shouldPlay={state.playing} onLoad={actions.loaded} style={styles.player} />
    </View>
  );
}
  
