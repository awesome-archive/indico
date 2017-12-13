/* This file is part of Indico.
 * Copyright (C) 2002 - 2017 European Organization for Nuclear Research (CERN).
 *
 * Indico is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * Indico is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Indico; if not, see <http://www.gnu.org/licenses/>.
 */

/* global ChooseUsersPopup:false, Palette:false */

(function($) {
    'use strict';

    var permissionClasses = {
        access: 'accept',
        registration: 'highlight',
        edit: 'danger',
        submit: 'warning'
    };

    $.widget('indico.permissionswidget', {
        options: {
            event_id: null
        },

        _update: function() {
            this.data = _(this.data).chain().sortBy(function(item) {
                return item[0].name || item[0].id;
            }).sortBy(function(item) {
                return item[0]._type;
            }).value();

            this.$dataField.val(JSON.stringify(this.data));
            this.element.trigger('change');
        },
        _renderRoleCode: function(code, color) {
            return $('<span>', {
                class: 'role-code',
                text: code,
                css: {
                    'border-color': '#' + color,
                    'color': '#' + color
                }
            });
        },
        _renderLabel: function(principal) {
            var $labelBox = $('<div>', {class: 'label-box flexrow f-a-center'});
            var type = principal._type;
            if (type === 'EventRole') {
                var $text = $('<span>', {class: 'text-normal entry-label', text: principal.name});
                var $code = this._renderRoleCode(principal.code, principal.color);
                return $labelBox.append($code).append($text);
            } else {
                var iconClass;
                if (type === 'Avatar') {
                    iconClass = 'icon-user';
                } else if (type === 'Email') {
                    iconClass = 'icon-mail';
                } else if (type === 'DefaultEntry' && principal.id === 'anonymous') {
                    iconClass = 'icon-question';
                } else if (type === 'IPNetworkGroup') {
                    iconClass = 'icon-lan';
                } else {
                    iconClass = 'icon-users';
                }
                var labelIsName = _.contains(['Avatar', 'DefaultEntry', 'IPNetworkGroup'], type);
                var text = labelIsName ? principal.name : principal.id;
                return $labelBox.append($('<span>', {class: 'entry-icon '  + iconClass}),
                    $('<span>', {class: 'text-normal entry-label', text: text}));
            }
        },
        _renderPermissions: function(principal, permissions) {
            var $permissions = $('<div>', {class: 'permissions-box flexrow f-a-center f-self-stretch'});
            var $permissionsList = $('<ul>').appendTo($permissions);

            permissions.forEach(function(item) {
                $permissionsList.append($('<li>', {class: 'i-label bold ' + permissionClasses[item]}).append(item));
            });

            $permissions.append(this._renderPermissionsButtons(principal, permissions));
            return $permissions;
        },
        _renderPermissionsButtons: function(principal, permissions) {
            var self = this;
            var $permissionsEditBtn;
            if (principal._type !== 'DefaultEntry') {
                var $buttonsGroup = $('<div>', {class: 'group flexrow'});
                if (principal._type === 'IPNetworkGroup') {
                    $permissionsEditBtn = $('<button>', {
                        type: 'button',
                        class: 'i-button text-color borderless icon-only icon-edit disabled',
                        title: $T('IP Networks can only have access permission')
                    });
                } else {
                    $permissionsEditBtn = $('<button>', {
                        'type': 'button',
                        'class': 'i-button text-color borderless icon-only icon-edit',
                        'data-href': build_url(Indico.Urls.EventPermissions, {confId: this.options.event_id}),
                        'data-title': $T.gettext('Assign Permissions'),
                        'data-ajax-dialog': '',
                        'data-params': JSON.stringify({principal: JSON.stringify(principal), permissions: permissions})
                    });
                }

                var $entryDeleteBtn = $('<button>', {
                    'type': 'button',
                    'class': 'i-button text-color borderless icon-only icon-remove',
                    'data-principal': JSON.stringify(principal)
                }).on('click', function() {
                    var $this = $(this);
                    var title = $T.gettext("Delete entry '{0}'".format(principal.name || principal.id));
                    var message = $T.gettext("Are you sure you want to permanently delete this entry?");
                    confirmPrompt(message, title).then(function() {
                        self._updateItem($this.data('principal'), []);
                    });
                });

                $buttonsGroup.append($permissionsEditBtn, $entryDeleteBtn);
                return $buttonsGroup;
            }
        },
        _renderItem: function(item) {
            var $item = $('<li>', {class: 'flexrow f-a-center'});
            var principal = item[0];
            var permissions = item[1];
            $item.append(this._renderLabel(principal));
            $item.append(this._renderPermissions(principal, permissions));
            $item.toggleClass('disabled ' + principal.id, principal._type === 'DefaultEntry');
            return $item;
        },
        _renderDropdown: function($dropdown) {
            var self = this;
            $dropdown.children().not('.default').remove();
            var $dropdownLink = $dropdown.prev('.js-dropdown');
            var items = $dropdown.data('items');
            var isRoleDropdown = $dropdown.hasClass('entry-role-dropdown');
            items.forEach(function(item) {
                if (self._findEntryIndex(item) === -1) {
                    if (isRoleDropdown) {
                        $dropdown.find('.separator').before(self._renderDropdownItem(item));
                    } else {
                        $dropdown.append(self._renderDropdownItem(item));
                    }
                }
            });
            if (isRoleDropdown) {
                var isEmpty = !$dropdown.children().not('.default').length;
                $('.entry-role-dropdown .separator').toggleClass('hidden', isEmpty);
            } else if (!$dropdown.children().length) {
                $dropdownLink.addClass('disabled').attr('title', $T('All IP Networks were added'));
            } else {
                $dropdownLink.removeClass('disabled');
            }
        },
        _renderDropdownItem: function(principal) {
            var self = this;
            var $dropdownItem = $('<li>', {'class': 'entry-item', 'data-principal': JSON.stringify(principal)});
            var $itemContent = $('<a>');
            if (principal._type === 'EventRole') {
                var $code = this._renderRoleCode(principal.code, principal.color).addClass('dropdown-icon');
                $itemContent.append($code);
            }
            var $text = $('<span>', {text: principal.name});
            $dropdownItem.append($itemContent.append($text)).on('click', function() {
                // Grant 'access' permissions when a role / IP Network is added.
                self._addItems([$(this).data('principal')], ['access']);
            });
            return $dropdownItem;
        },
        _renderTooltip: function(idx) {
            this.$permissionsWidgetList.find('>li').not('.disabled').eq(idx).qtip({
                content: {
                    text: $T('This entry was already added')
                },
                show: {
                    ready: true,
                    effect: function() {
                        $(this).fadeIn(300);
                    }
                },
                hide: {
                    event: 'unfocus click'
                },
                events: {
                    hide: function() {
                        $(this).fadeOut(300);
                        $(this).qtip('destroy');
                    }
                },
                position: {
                    my: 'center left',
                    at: 'center right'
                },
                style: {
                    classes: 'qtip-warning'
                }
            });
        },
        _render: function() {
            var self = this;
            this.$permissionsWidgetList.empty();

            this.data.forEach(function(item) {
                self.$permissionsWidgetList.append(self._renderItem(item));
            });
            // Add default entries
            var categoryManagers = [{
                _type: 'DefaultEntry', name: $T('Category Managers'), id: 'category-managers'
            }, ['edit']];
            var anonymous = [{_type: 'DefaultEntry', name: $T('Anonymous'), id: 'anonymous'}, ['access']];
            self.$permissionsWidgetList.prepend(self._renderItem(categoryManagers));
            self.$permissionsWidgetList.append(self._renderItem(anonymous));
            self.$permissionsWidgetList.find('.anonymous').toggle(!self.isEventProtected);

            this._renderDropdown(this.$roleDropdown);
            if (this.$ipNetworkDropdown.length) {
                this._renderDropdown(this.$ipNetworkDropdown);
            }
        },
        _findEntryIndex: function(principal) {
            return _.findIndex(this.data, function(item) {
                return item[0].identifier === principal.identifier;
            });
        },
        _updateItem: function(principal, newPermissions) {
            var idx = this._findEntryIndex(principal);
            if (newPermissions.length) {
                this.data[idx][1] = newPermissions;
            } else {
                this.data.splice(idx, 1);
            }
            this._update();
            this._render();
        },
        _addItems: function(principals, permissions) {
            var self = this;
            var news = [];
            var repeated = [];
            principals.forEach(function(principal) {
                var idx = self._findEntryIndex(principal);
                if (idx === -1) {
                    self.data.push([principal, permissions]);
                    news.push(principal);
                } else {
                    repeated.push(principal);
                }
            });
            this._update();
            this._render();
            news.forEach(function(principal) {
                self.$permissionsWidgetList.find('>li').not('.disabled').eq(self._findEntryIndex(principal))
                    .effect('highlight', {color: Palette.highlight}, 'slow');
            });
            repeated.forEach(function(principal) {
                self._renderTooltip(self._findEntryIndex(principal));
            });
        },
        _addUserGroup: function() {
            var self = this;
            function _addPrincipals(principals) {
                // Grant 'access' permissions when a user/group is added for the first time.
                self._addItems(principals, ['access']);
            }

            var dialog = new ChooseUsersPopup(
                $T("Select a user or group to add"),
                true, null, true, true, null, false, false, false, _addPrincipals, null, true
            );

            dialog.execute();
        },
        _create: function() {
            var self = this;
            this.$permissionsWidgetList = this.element.find('.permissions-widget-list');
            this.$dataField = this.element.find('input[type=hidden]');
            this.$roleDropdown = this.element.find('.entry-role-dropdown');
            this.$ipNetworkDropdown = this.element.find('.entry-ip-network-dropdown');
            this.data = JSON.parse(this.$dataField.val());
            this._update();
            this._render();

            this.element.on('indico:permissionsChanged', function(evt, permissions, principal) {
                self._updateItem(principal, permissions);
            });

            this.element.on('indico:protectionModeChanged', function(evt, isProtected) {
                self.isEventProtected = isProtected;
                self._render();
            });

            // Manage the addition to users/groups to the acl
            $('.js-add-user-group').on('click', function() {
                self._addUserGroup();
            });

            // Manage the creation of new roles
            $('body').on('ajaxForm:success', function(evt, data) {
                if (data.role) {
                    self.$roleDropdown.data('items').push(data.role);
                    self._addItems([data.role], ['access']);
                }
            });

            // Apply ellipsis + tooltip on long names
            this.$permissionsWidgetList.on('mouseenter', '.entry-label', function() {
                var $this = $(this);
                if (this.offsetWidth < this.scrollWidth && !$this.attr('title')) {
                    $this.attr('title', $this.text());
                }
            });
        }
    });
})(jQuery);