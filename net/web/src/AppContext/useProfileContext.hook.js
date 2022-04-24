import { useEffect, useState, useRef } from 'react';
import { getProfile } from '../Api/getProfile';
import { setProfileData } from '../Api/setProfileData';
import { setProfileImage } from '../Api/setProfileImage';
import { getProfileImageUrl } from '../Api/getProfileImageUrl';

export function useProfileContext() {
  const [state, setState] = useState({
    profile: {},
  });
  const access = useRef(null);
  const revision = useRef(null);
  const next = useRef(null);

  const updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  const setProfile = async (rev) => {
    if (next.current == null) {
      if (revision.current != rev) {
        let profile = await getProfile(access.current);
        updateState({ profile });
        revision.current = rev;
      }
      if (next.current != null) {
        let r = next.current;
        next.current = null;
        setProfile(r);
      }
    }
    else {
      next.current = rev;
    }
  }

  const actions = {
    setToken: (token) => {
      access.current = token;
    },
    setRevision: (rev) => {
      setProfile(rev);
    },
    setProfileData: async (name, location, description) => {
      await setProfileData(state.token, name, location, description);
    },
    setProfileImage: async (image) => {
      await setProfileImage(state.token, image);
    },
    profileImageUrl: () => getProfileImageUrl(access.current, revision.current),
  }

  return { state, actions }
}


