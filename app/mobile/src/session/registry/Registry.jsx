import { useContext } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, View, TextInput, TouchableOpacity, Text } from 'react-native';
import { styles } from './Registry.styled';
import { useRegistry } from './useRegistry.hook';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/AntDesign';
import { RegistryItem } from './registryItem/RegistryItem';
import Colors from 'constants/Colors';

export function RegistryTitle({ state, actions }) {

  const search = async () => {
    try {
      await actions.search();
    }
    catch (err) {
      console.log(err);
      Alert.alert(
        'Server Listing Failed',
        'Please try again.'
      );
    }
  }

  return (
    <View style={styles.title}>
      { !state.filter && (
        <TouchableOpacity style={styles.sort} onPress={actions.filter}>
          <Ionicons style={styles.icon} name="filter" size={18} color={Colors.disabled} />
        </TouchableOpacity>
      )}
      { state.filter && (
        <View style={styles.filterwrapper}>
          <TextInput style={styles.inputfield} value={state.username} onChangeText={actions.setUsername}
              autoCorrect={false} autoCapitalize="none" placeholderTextColor={Colors.disabled} placeholder="Username" />
        </View>
      )}
      <View style={styles.inputwrapper}>
        <TextInput style={styles.inputfield} value={state.server} onChangeText={actions.setServer}
            autoCorrect={false} autoCapitalize="none" placeholderTextColor={Colors.disabled} placeholder="Server" />
      </View>
      { state.busy && (
        <View style={styles.search}>
          <ActivityIndicator />
        </View>
      )}
      { !state.busy && (
        <TouchableOpacity style={styles.search} onPress={search}>
          <Ionicons name={'search1'} size={16} color={Colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function RegistryBody({ state, actions, openContact }) {

  return (
    <View style={styles.accounts}> 
      { state.accounts.length === 0 && state.searched && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No Contacts Found</Text>
        </View>
      )}
      { state.accounts.length !== 0 && (
        <FlatList
          data={state.accounts}
          renderItem={({ item }) => <RegistryItem item={item} openContact={openContact} />}
          keyExtractor={item => item.guid}
        />
      )}
    </View>
  );
}


export function Registry({ closeRegistry, openContact }) {

  const search = async () => {
    try {
      await actions.search();
    }
    catch (err) {
      console.log(err);
      Alert.alert(
        'Server Listing Failed',
        'Please try again.'
      );
    }
  }

  const { state, actions } = useRegistry();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom']}>
      <RegistryTitle state={state} actions={actions} />
      <RegistryBody state={state} actions={actions} openContact={openContact} />
    </SafeAreaView>
  );
}

