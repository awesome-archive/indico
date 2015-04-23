# This file is part of Indico.
# Copyright (C) 2002 - 2015 European Organization for Nuclear Research (CERN).
#
# Indico is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License as
# published by the Free Software Foundation; either version 3 of the
# License, or (at your option) any later version.
#
# Indico is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Indico; if not, see <http://www.gnu.org/licenses/>.

from __future__ import unicode_literals

from operator import attrgetter

from persistent.cPersistence import Persistent

from indico.modules.users.legacy import encode_utf8, AvatarUserWrapper
from indico.util.fossilize import Fossilizable, fossilizes
from indico.util.string import to_unicode, return_ascii
from MaKaC.common.Locators import Locator
from MaKaC.fossils.user import IGroupFossil


class GroupWrapper(Persistent, Fossilizable):
    """Group-like wrapper class that holds a DB-stored (or remote) group."""

    fossilizes(IGroupFossil)

    def __init__(self, group_id):
        self.id = to_unicode(group_id).encode('utf-8')

    @property
    def group(self):
        """Returns the underlying GroupProxy

        :rtype: indico.modules.groups.core.GroupProxy
        """
        raise NotImplementedError

    def getId(self):
        return self.id

    def getName(self):
        raise NotImplementedError

    def getFullName(self):
        return self.getName()

    def getDescription(self):
        return ''

    def setDescription(self, value):
        pass

    def getEmail(self):
        return ''

    def isObsolete(self):
        return False

    def containsUser(self, avatar):
        return self.group.has_member(avatar.user)

    def getMemberList(self):
        return sorted([x.as_avatar for x in self.group.get_members()], key=attrgetter('user.last_name'))

    def canModify(self, aw_or_user):
        if hasattr(aw_or_user, 'getUser'):
            aw_or_user = aw_or_user.getUser()
        return self.canUserModify(aw_or_user)

    def canUserModify(self, avatar):
        return avatar.user.is_admin

    def getLocator(self):
        return Locator(groupId=self.id)

    def exists(self):
        return self.group.group is not None

    def __eq__(self, other):
        from indico.modules.groups.core import GroupProxy
        if not hasattr(other, 'group') or not isinstance(other.group, GroupProxy):
            return False
        return self.group == other.group

    def __hash__(self):
        return hash(self.group)

    @return_ascii
    def __repr__(self):
        return u'<{} {}: {}>'.format(type(self).__name__, self.id, self.group)


class LocalGroupWrapper(GroupWrapper):
    is_local = True
    groupType = 'Default'

    @property
    def group(self):
        from indico.modules.groups.core import GroupProxy
        return GroupProxy(self.id)

    @encode_utf8
    def getName(self):
        return self.group.group.name if self.exists() else self.id

    def addMember(self, member):
        if not isinstance(member, AvatarUserWrapper):
            raise TypeError('Groups can only contain users')
        group = self.group.group  # needed to avoid GC
        group.members.add(member.user)

    def removeMember(self, member):
        if not isinstance(member, AvatarUserWrapper):
            raise TypeError('Groups can only contain users')
        group = self.group.group  # needed to avoid GC
        group.members.discard(member.user)


class LDAPGroupWrapper(GroupWrapper):
    is_local = False
    provider_name = None
    groupType = 'LDAP'

    @property
    def provider(self):
        from indico.modules.auth import multipass
        provider_name = self.provider_name
        if not provider_name:
            provider_name = next((provider.name for provider in multipass.identity_providers.itervalues()
                                  if provider.settings.get('legacy_groups')), None)
            assert provider_name, 'No identity provider has legacy_groups enabled'
        return provider_name

    @property
    def group(self):
        from indico.modules.groups.core import GroupProxy
        return GroupProxy(self.id, self.provider)

    @encode_utf8
    def getName(self):
        return self.id
