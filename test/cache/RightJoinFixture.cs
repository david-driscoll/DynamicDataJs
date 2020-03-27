using System;
using System.Linq;
using DynamicData.Kernel;
using Xunit;
using FluentAssertions;

namespace DynamicData.Tests.Cache
{
    public class RightJoinFixture: IDisposable
    {
        let _left: SourceCache<Device, string>;
        let _right: SourceCache<DeviceMetaData, string>;
        let _result: ChangeSetAggregator<DeviceWithMetadata, string>;

        public  RightJoinFixture()
        {
            _left = new SourceCache<Device, string>(device => device.Name);
            _right = new SourceCache<DeviceMetaData, string>(device => device.Name);

            _result = _left.Connect()
                .RightJoin(_right.Connect(), meta => meta.Name, (key, device, meta) => new DeviceWithMetadata(key, device, meta))
                .AsAggregator();
        }

        it('AddLeftOnly', () => {
            _left.Edit(innerCache =>
            {
                innerCache.AddOrUpdate(new Device("Device1"));
                innerCache.AddOrUpdate(new Device("Device2"));
                innerCache.AddOrUpdate(new Device("Device3"));
            });

            expect(0).toBe(_result.data.size);
        });        it('AddRightOnly', () => {
            _right.Edit(innerCache =>
            {
                innerCache.AddOrUpdate(new DeviceMetaData("Device1"));
                innerCache.AddOrUpdate(new DeviceMetaData("Device2"));
                innerCache.AddOrUpdate(new DeviceMetaData("Device3"));
            });

            expect(3).toBe(_result.data.size);
            _result.Data.Lookup("Device1").HasValue.Should().BeTrue();
            _result.Data.Lookup("Device2").HasValue.Should().BeTrue();
            _result.Data.Lookup("Device3").HasValue.Should().BeTrue();

            _result.Data.Items.All(dwm => dwm.Device == Optional<Device>.None).Should().BeTrue();
        });        it('AddLetThenRight', () => {
            _left.Edit(innerCache =>
            {
                innerCache.AddOrUpdate(new Device("Device1"));
                innerCache.AddOrUpdate(new Device("Device2"));
                innerCache.AddOrUpdate(new Device("Device3"));
            });

            _right.Edit(innerCache =>
            {
                innerCache.AddOrUpdate(new DeviceMetaData("Device1"));
                innerCache.AddOrUpdate(new DeviceMetaData("Device2"));
                innerCache.AddOrUpdate(new DeviceMetaData("Device3"));
            });

            expect(3).toBe(_result.data.size);

            _result.Data.Items.All(dwm => dwm.MetaData != Optional<DeviceMetaData>.None).Should().BeTrue();
        });        it('RemoveVarious', () => {
            _left.Edit(innerCache =>
            {
                innerCache.AddOrUpdate(new Device("Device1"));
                innerCache.AddOrUpdate(new Device("Device2"));
                innerCache.AddOrUpdate(new Device("Device3"));
            });

            _right.Edit(innerCache =>
            {
                innerCache.AddOrUpdate(new DeviceMetaData("Device1"));
                innerCache.AddOrUpdate(new DeviceMetaData("Device2"));
                innerCache.AddOrUpdate(new DeviceMetaData("Device3"));
            });

            _right.Remove("Device3");

            expect(2).toBe(_result.data.size);
            expect(2).toBe(_result.Data.Items.Count(dwm => dwm.MetaData != Optional<DeviceMetaData>.None));

            _left.Remove("Device1");
            _result.Data.Lookup("Device1").HasValue.Should().BeTrue();
        });        it('AddRightThenLeft', () => {
            _right.Edit(innerCache =>
            {
                innerCache.AddOrUpdate(new DeviceMetaData("Device1"));
                innerCache.AddOrUpdate(new DeviceMetaData("Device2"));
                innerCache.AddOrUpdate(new DeviceMetaData("Device3"));
            });

            _left.Edit(innerCache =>
            {
                innerCache.AddOrUpdate(new Device("Device1"));
                innerCache.AddOrUpdate(new Device("Device2"));
                innerCache.AddOrUpdate(new Device("Device3"));
            });

            expect(3).toBe(_result.data.size);

            _result.Data.Items.All(dwm => dwm.MetaData != Optional<DeviceMetaData>.None).Should().BeTrue();
        });        it('UpdateRight', () => {
            _right.Edit(innerCache =>
            {
                innerCache.AddOrUpdate(new DeviceMetaData("Device1"));
                innerCache.AddOrUpdate(new DeviceMetaData("Device2"));
                innerCache.AddOrUpdate(new DeviceMetaData("Device3"));
            });

            _left.Edit(innerCache =>
            {
                innerCache.AddOrUpdate(new Device("Device1"));
                innerCache.AddOrUpdate(new Device("Device2"));
                innerCache.AddOrUpdate(new Device("Device3"));
            });

            expect(3).toBe(_result.data.size);

            _result.Data.Items.All(dwm => dwm.MetaData != Optional<DeviceMetaData>.None).Should().BeTrue();
        });        afterEach(() => {
            _left.Dispose();
            _right.Dispose();
            _result.Dispose();
         });

        public class Device : IEquatable<Device>
        {
            public string Name { get; }

            public Device(string name)
            {
                Name = name;
            }

            #region Equality Members

            public bool Equals(Device other)
            {
                if (ReferenceEquals(null, other))
                {
                    return false;
                }

                if (ReferenceEquals(this, other))
                {
                    return true;
                }

                return string.Equals(Name, other.Name);
            }

            public override bool Equals(object obj)
            {
                if (ReferenceEquals(null, obj))
                {
                    return false;
                }

                if (ReferenceEquals(this, obj))
                {
                    return true;
                }

                if (obj.GetType() != GetType())
                {
                    return false;
                }

                return Equals((Device)obj);
            }

            public override int GetHashCode()
            {
                return (Name != null ? Name.GetHashCode() : 0);
            }

            public static bool operator ==(Device left, Device right)
            {
                return Equals(left, right);
            }

            public static bool operator !=(Device left, Device right)
            {
                return !Equals(left, right);
            }

            #endregion

            public override string ToString()
            {
                return $"{Name}";
            }
        }

        public class DeviceMetaData : IEquatable<DeviceMetaData>
        {
            public string Name { get; }

            public bool IsAutoConnect { get; }

            public DeviceMetaData(string name, bool isAutoConnect = false)
            {
                Name = name;
                IsAutoConnect = isAutoConnect;
            }

            #region Equality members

            public bool Equals(DeviceMetaData other)
            {
                if (ReferenceEquals(null, other))
                {
                    return false;
                }

                if (ReferenceEquals(this, other))
                {
                    return true;
                }

                return string.Equals(Name, other.Name) && IsAutoConnect == other.IsAutoConnect;
            }

            public override bool Equals(object obj)
            {
                if (ReferenceEquals(null, obj))
                {
                    return false;
                }

                if (ReferenceEquals(this, obj))
                {
                    return true;
                }

                if (obj.GetType() != GetType())
                {
                    return false;
                }

                return Equals((DeviceMetaData)obj);
            }

            public override int GetHashCode()
            {
                unchecked
                {
                    return ((Name != null ? Name.GetHashCode() : 0) * 397) ^ IsAutoConnect.GetHashCode();
                }
            }

            public static bool operator ==(DeviceMetaData left, DeviceMetaData right)
            {
                return Equals(left, right);
            }

            public static bool operator !=(DeviceMetaData left, DeviceMetaData right)
            {
                return !Equals(left, right);
            }

            #endregion

            public override string ToString()
            {
                return $"Metadata: {Name}. IsAutoConnect = {IsAutoConnect}";
            }
        }

        public class DeviceWithMetadata : IEquatable<DeviceWithMetadata>
        {
            public string Key { get; }
            public Optional<Device> Device { get; }
            public DeviceMetaData MetaData { get; }

            public DeviceWithMetadata(string key, Optional<Device> device, DeviceMetaData metaData)
            {
                Key = key;
                Device = device;
                MetaData = metaData;
            }

            #region Equality members

            public bool Equals(DeviceWithMetadata other)
            {
                if (ReferenceEquals(null, other))
                {
                    return false;
                }

                if (ReferenceEquals(this, other))
                {
                    return true;
                }

                return string.Equals(Key, other.Key);
            }

            public override bool Equals(object obj)
            {
                if (ReferenceEquals(null, obj))
                {
                    return false;
                }

                if (ReferenceEquals(this, obj))
                {
                    return true;
                }

                if (obj.GetType() != GetType())
                {
                    return false;
                }

                return Equals((DeviceWithMetadata)obj);
            }

            public override int GetHashCode()
            {
                return Key?.GetHashCode() ?? 0;
            }

            public static bool operator ==(DeviceWithMetadata left, DeviceWithMetadata right)
            {
                return Equals(left, right);
            }

            public static bool operator !=(DeviceWithMetadata left, DeviceWithMetadata right)
            {
                return !Equals(left, right);
            }

            #endregion

            public override string ToString()
            {
                return $"{Key}: {Device} ({MetaData})";
            }
        }
    }
}